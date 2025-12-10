import re
import ipaddress
import sys
import os
import argparse

# -----------------------------------------------------------
# 1. Parsing Helpers (데이터 추출 로직)
# -----------------------------------------------------------

def get_hostname(config_content):
    match = re.search(r'system\s+name\s+"?([^"\n]+)"?', config_content)
    if match:
        return match.group(1)
    return "Nokia_SR"

def clean_desc(text):
    """Mermaid 및 HTML 오류 방지 문자 처리"""
    if not text: return ""
    text = text.replace('&', ' and ').replace('"', "'")
    text = text.replace('<', '&lt;').replace('>', '&gt;')
    return " ".join(text.split())

def parse_nokia_qos(sap_block):
    """
    [v1 Logic 복원] SAP 블록 내부에서 Ingress/Egress QoS ID 추출
    """
    ingress_qos, egress_qos = "Default", "Default"
    
    # Ingress QoS 찾기
    ingress_match = re.search(r'ingress(.*?)exit', sap_block, re.DOTALL)
    if ingress_match:
        in_qos = re.search(r'qos\s+(\d+)', ingress_match.group(1))
        if in_qos: ingress_qos = in_qos.group(1)
        
    # Egress QoS 찾기
    egress_match = re.search(r'egress(.*?)exit', sap_block, re.DOTALL)
    if egress_match:
        out_qos = re.search(r'qos\s+(\d+)', egress_match.group(1))
        if out_qos: egress_qos = out_qos.group(1)
        
    return ingress_qos, egress_qos

def get_interface_block_by_indent(lines, target_interface):
    """들여쓰기 기반 인터페이스 블록 추출 (v1 Logic)"""
    target_start_1 = f'interface "{target_interface}"'
    target_start_2 = f'interface {target_interface} ' 
    
    candidates = []
    
    i = 0
    while i < len(lines):
        line = lines[i]
        if target_start_1 in line or target_start_2 in line:
            start_indent = len(line) - len(line.lstrip())
            block_lines = [line]
            
            i += 1
            while i < len(lines):
                next_line = lines[i]
                if not next_line.strip() or next_line.strip().startswith('#'):
                    block_lines.append(next_line); i += 1; continue

                next_indent = len(next_line) - len(next_line.lstrip())
                if next_line.strip() == 'exit' and next_indent == start_indent:
                    block_lines.append(next_line); break
                if next_indent < start_indent and next_line.strip() != 'exit': break

                block_lines.append(next_line)
                i += 1
            candidates.append("\n".join(block_lines))
        i += 1

    for block in candidates:
        if "address " in block: return block
    return candidates[-1] if candidates else None

def get_service_info(lines, target_interface):
    """Service 정보 추출 (v1 Logic: 역방향 들여쓰기 검색)"""
    target_idx = -1
    target_str_1 = f'interface "{target_interface}"'
    target_str_2 = f'interface {target_interface} '

    for idx, line in enumerate(lines):
        if (target_str_1 in line or target_str_2 in line):
             if "address " in "\n".join(lines[idx:idx+20]):
                 target_idx = idx
                 break
    
    if target_idx == -1:
        for idx, line in enumerate(lines):
            if target_str_1 in line or target_str_2 in line: 
                target_idx = idx; break

    if target_idx == -1: return "Unknown Svc", ""

    svc_type = "Unknown"
    svc_desc = ""
    if_indent = len(lines[target_idx]) - len(lines[target_idx].lstrip())
    
    for i in range(target_idx, -1, -1):
        line = lines[i]
        current_indent = len(line) - len(line.lstrip())
        
        if current_indent < if_indent:
            match = re.search(r'^\s*(ies|vpls|vprn|epipe)\s+(\d+)', line, re.IGNORECASE)
            if match:
                svc_header = line.strip()
                svc_type = f"{match.group(1).upper()} {match.group(2)}"
                
                for j in range(i+1, min(i+30, len(lines))):
                    sub_line = lines[j]
                    if len(sub_line) - len(sub_line.lstrip()) <= current_indent: break
                    desc_match = re.search(r'description\s+"?([^"\n]+)"?', sub_line)
                    if desc_match:
                        svc_desc = desc_match.group(1)
                        break
                break
    return svc_type, clean_desc(svc_desc)

def get_port_description(config_content, if_block):
    """Port Description 추출"""
    sap_match = re.search(r'sap\s+([0-9/]+)', if_block)
    if not sap_match: return "N/A", ""
    
    port_id = sap_match.group(1)
    port_pattern = re.compile(rf'^\s*port {port_id}(.*?)^[\s]*exit', re.DOTALL | re.MULTILINE)
    port_match = port_pattern.search(config_content)
    
    port_desc = ""
    if port_match:
        p_block = port_match.group(1)
        d_match = re.search(r'description\s+"?([^"\n]+)"?', p_block)
        if d_match: port_desc = clean_desc(d_match.group(1))
            
    return port_id, port_desc

# -----------------------------------------------------------
# 2. Mermaid Diagram Generator
# -----------------------------------------------------------

def generate_custom_diagram(config_content, target_interface):
    hostname = get_hostname(config_content)
    lines = config_content.splitlines()
    
    # 1. Data Parsing
    if_block = get_interface_block_by_indent(lines, target_interface)
    if not if_block: return f"Error: Interface '{target_interface}' not found."

    ip_match = re.search(r'address\s+([\d\.]+)/(\d+)', if_block)
    if not ip_match: 
        ip_addr, prefix_len = "N/A", "0"
        network = None
    else:
        ip_addr = ip_match.group(1)
        prefix_len = ip_match.group(2)
        try: network = ipaddress.ip_network(f"{ip_addr}/{prefix_len}", strict=False)
        except ValueError: network = None

    desc_match = re.search(r'description\s+"?([^"\n]+)"?', if_block)
    if_desc = clean_desc(desc_match.group(1)) if desc_match else ""

    svc_id, svc_desc = get_service_info(lines, target_interface)
    port_id, port_desc = get_port_description(config_content, if_block)

    # [NEW] QoS Parsing Logic Added (v1 restoration)
    # SAP 구문 안에서 ingress/egress qos 정보 추출
    sap_match = re.search(r'sap\s+(.+?)\s+create(.*?)exit', if_block, re.DOTALL)
    ingress_qos, egress_qos = "Default", "Default"
    if sap_match:
        # sap_match.group(2) contains the content inside 'sap ... create'
        ingress_qos, egress_qos = parse_nokia_qos(sap_match.group(2))
    
    # QoS Label for the Link
    qos_label = f"In-QoS: {ingress_qos}<br/>Out-QoS: {egress_qos}"

    # 2. Next-Hop & Static Route Logic
    peer_ip = "Unknown"
    related_routes = []
    
    static_routes = re.findall(r'static-route\s+([\d\./]+)\s+next-hop\s+([\d\.]+)', config_content)
    
    if network:
        for route_dst, next_hop in static_routes:
            try:
                nh_obj = ipaddress.ip_address(next_hop)
                if nh_obj in network and str(nh_obj) != ip_addr:
                    peer_ip = next_hop
                    related_routes.append(route_dst)
            except ValueError: continue
        
        if peer_ip == "Unknown" and network.prefixlen == 30:
            hosts = list(network.hosts())
            for h in hosts:
                if str(h) != ip_addr:
                    peer_ip = str(h)
                    break

    # -------------------------------------------------------
    # 3. Build Mermaid Graph
    # -------------------------------------------------------
    mermaid = ["graph LR"]
    
    def fmt_desc(d):
        return f"<br/>({d})" if d else ""

    # [Left Box]
    left_label = (
        f"<div style='text-align: left'>"
        f"<b>Port:</b> {port_id} {fmt_desc(port_desc)}<br/><br/>"
        f"<b>Interface:</b> {target_interface} {fmt_desc(if_desc)}<br/><br/>"
        f"<b>IP:</b> {ip_addr}/{prefix_len}<br/><br/>"
        f"<b>Service:</b> {svc_id} {fmt_desc(svc_desc)}"
        f"</div>"
    )
    
    mermaid.append(f'    subgraph Host ["{hostname}"]')
    mermaid.append(f'        A["{left_label}"]')
    mermaid.append(f'    end')

    # [Right Box]
    right_title = port_desc if port_desc else "Remote Connected Device"
    
    mermaid.append(f'    subgraph Remote ["{right_title}"]')
    mermaid.append(f'        B["<b>Next-Hop</b><br/>{peer_ip}"]')

    if related_routes:
        routes_str = "<br/>".join(related_routes)
        c_label = f"<b>Customer Network</b><br/>{routes_str}"
    else:
        c_label = "<b>Customer Network</b>"

    mermaid.append(f'        C["{c_label}"]')
    mermaid.append(f'    end')

    # Links (Updated with QoS Label)
    mermaid.append(f'    A -->|"{qos_label}"| B')
    mermaid.append(f'    B -.-> C')

    # Styles
    mermaid.append('    style A fill:#ffffff,stroke:#333,stroke-width:2px,color:#000,text-align:left')
    mermaid.append('    style B fill:#e6f3ff,stroke:#0066cc,stroke-width:2px,color:#000')
    mermaid.append('    style C fill:#ffffff,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5')

    return "\n".join(mermaid)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-f", "--file", type=str, required=True)
    parser.add_argument("-i", "--interface", type=str, required=True)
    
    args = parser.parse_args()

    if not os.path.exists(args.file):
        sys.exit(f"Error: File {args.file} not found")

    try:
        with open(args.file, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        sys.exit(f"Error reading file: {e}")

    result = generate_custom_diagram(content, args.interface)
    
    print("\n" + "="*40)
    print("      Mermaid Code Output")
    print("="*40)
    print("```mermaid")
    print(result)
    print("```")
    print("="*40 + "\n")

if __name__ == "__main__":
    main()