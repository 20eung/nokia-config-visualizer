import re
import ipaddress
import sys
import os
import argparse

def print_banner():
    print("=" * 60)
    print("      Nokia 7750 SR Config Visualizer (Mermaid Generator)      ")
    print("      Dev by: Senior NetDevOps Architect                       ")
    print("=" * 60)

def get_hostname(config_content):
    match = re.search(r'system\s+name\s+"([^"]+)"', config_content)
    if match:
        return match.group(1)
    return "Local Device"

def clean_desc(text):
    """
    Mermaid 문법 오류 방지를 위해 특수문자 처리.
    1. & (Ampersand) -> 'and'로 변환
    2. HTML 태그 충돌 방지
    3. 따옴표 처리
    """
    if not text: return "N/A"
    
    # & 기호를 and로 치환하여 문법 오류 원천 차단
    text = text.replace('&', ' and ')
    
    # HTML 엔티티 및 따옴표 처리
    text = text.replace('"', "'").replace('<', '&lt;').replace('>', '&gt;')
    
    # 연속된 공백 제거 (깔끔하게)
    return " ".join(text.split())

def get_interface_block_by_indent(lines, target_interface):
    """들여쓰기 기반 인터페이스 블록 추출"""
    target_start = f'interface "{target_interface}" create'
    candidates = []
    
    i = 0
    while i < len(lines):
        line = lines[i]
        if target_start in line:
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
    """인터페이스가 속한 Service (IES/VPLS/VPRN) 정보를 역추적"""
    target_start = f'interface "{target_interface}" create'
    target_idx = -1
    for idx, line in enumerate(lines):
        if target_start in line and "address " in "\n".join(lines[idx:idx+20]):
             target_idx = idx
             break
    
    if target_idx == -1:
        for idx, line in enumerate(lines):
            if target_start in line: target_idx = idx; break

    if target_idx == -1: return "N/A", "N/A"

    svc_type = "N/A"
    svc_desc = "N/A"
    if_indent = len(lines[target_idx]) - len(lines[target_idx].lstrip())
    
    for i in range(target_idx, -1, -1):
        line = lines[i]
        current_indent = len(line) - len(line.lstrip())
        if current_indent < if_indent and re.search(r'^\s*(ies|vpls|vprn)\s+\d+', line):
            svc_header = line.strip()
            svc_type = svc_header.split(' ')[0].upper() + " " + svc_header.split(' ')[1]
            
            for j in range(i+1, min(i+20, len(lines))):
                sub_line = lines[j]
                if len(sub_line) - len(sub_line.lstrip()) <= current_indent: break
                desc_match = re.search(r'description "(.+?)"', sub_line)
                if desc_match:
                    svc_desc = desc_match.group(1)
                    break
            break
            
    return svc_type, clean_desc(svc_desc)

def get_port_description(config_content, if_block):
    """Port Description 추출"""
    sap_match = re.search(r'sap\s+(\d+/\d+/\d+)', if_block)
    if not sap_match: return "N/A", "Virtual/System Interface"
    
    port_id = sap_match.group(1)
    port_pattern = re.compile(f'^\s*port {port_id}(.*?)^[\s]*exit', re.DOTALL | re.MULTILINE)
    port_match = port_pattern.search(config_content)
    
    port_desc = "N/A"
    if port_match:
        p_block = port_match.group(1)
        d_match = re.search(r'description "(.+?)"', p_block)
        if d_match: port_desc = clean_desc(d_match.group(1))
            
    return port_id, port_desc

def parse_nokia_qos(sap_block):
    ingress_qos, egress_qos = "Default", "Default"
    ingress_match = re.search(r'ingress(.*?)exit', sap_block, re.DOTALL)
    if ingress_match:
        in_qos = re.search(r'qos (\d+)', ingress_match.group(1))
        if in_qos: ingress_qos = in_qos.group(1)
    egress_match = re.search(r'egress(.*?)exit', sap_block, re.DOTALL)
    if egress_match:
        out_qos = re.search(r'qos (\d+)', egress_match.group(1))
        if out_qos: egress_qos = out_qos.group(1)
    return ingress_qos, egress_qos

def generate_diagram(config_content, target_interface):
    hostname = get_hostname(config_content)
    lines = config_content.splitlines()
    if_block = get_interface_block_by_indent(lines, target_interface)

    if not if_block: return f"Error: Interface '{target_interface}' not found."

    ip_match = re.search(r'address ([\d\.]+)/(\d+)', if_block)
    if not ip_match: ip_addr, prefix_len, network = "N/A", 0, None
    else:
        ip_addr = ip_match.group(1)
        prefix_len = int(ip_match.group(2))
        try: network = ipaddress.ip_network(f"{ip_addr}/{prefix_len}", strict=False)
        except ValueError: network = None

    desc_match = re.search(r'description "(.+?)"', if_block)
    if_desc = clean_desc(desc_match.group(1)) if desc_match else "N/A"

    svc_id, svc_desc = get_service_info(lines, target_interface)
    port_id, port_desc = get_port_description(config_content, if_block)

    sap_match = re.search(r'sap (.+?) create(.*?)exit', if_block, re.DOTALL)
    ingress_qos, egress_qos = "Default", "Default"
    if sap_match: ingress_qos, egress_qos = parse_nokia_qos(sap_match.group(2))
    
    qos_label = f"In-QoS:{ingress_qos}<br>Out-QoS:{egress_qos}"

    related_routes = []
    static_routes = re.findall(r'static-route ([\d\./]+) next-hop ([\d\.]+)(.*)', config_content)
    peer_ip = "Unknown Peer"
    if network:
        for route_dst, next_hop, rest in static_routes:
            try:
                nh_obj = ipaddress.ip_address(next_hop)
                if nh_obj in network and str(nh_obj) != ip_addr:
                    peer_ip = next_hop
                    related_routes.append({"dst": route_dst})
            except ValueError: continue

    # --- Mermaid Generation ---
    mermaid = ["graph LR"]
    
    # 1. Local Subgraph (따옴표 추가로 특수문자 방지)
    mermaid.append(f'    subgraph Local ["{hostname}"]')
    mermaid.append(f'        MyInt[Interface: {target_interface}<br>IP: {ip_addr}/{prefix_len}]')
    mermaid.append(f'    end')

    # 2. Remote Subgraph (이 부분이 핵심 수정 사항: 따옴표 추가)
    mermaid.append(f'    subgraph Remote ["{if_desc}"]')
    mermaid.append(f'        PeerRouter[Peer Router<br>Next-Hop: {peer_ip}]')
    
    if related_routes:
        for idx, route in enumerate(related_routes):
            label = f"Customer Network<br>Static Route<br>{route['dst']}"
            mermaid.append(f'        RemoteNet{idx}[{label}]')
            mermaid.append(f'        PeerRouter --> RemoteNet{idx}')
            mermaid.append(f'        style RemoteNet{idx} fill:#eee,stroke:#333,stroke-dasharray: 5 5')
    else:
        mermaid.append(f'        RemoteNet0[Remote Network]')
        mermaid.append(f'        PeerRouter --> RemoteNet0')
        mermaid.append(f'        style RemoteNet0 fill:#eee,stroke:#333,stroke-dasharray: 5 5')
    mermaid.append(f'    end')

    mermaid.append(f'    MyInt -- "{qos_label}" --- PeerRouter')
    
    # 3. Description Table Box
    desc_table_html = (
        f"<b>Configuration Details</b><hr/>"
        f"<b>Service:</b> {svc_id} ({svc_desc})<br/>"
        f"<b>Interface:</b> {target_interface} ({if_desc})<br/>"
        f"<b>Physical Port:</b> {port_id} ({port_desc})"
    )
    
    mermaid.append(f'    subgraph Details [Config Description Table]')
    mermaid.append(f'        direction TB')
    mermaid.append(f'        InfoNode["{desc_table_html}"]')
    mermaid.append(f'    end')

    mermaid.append('    style MyInt fill:#fff,stroke:#333,stroke-width:2px')
    mermaid.append('    style PeerRouter fill:#e1f5fe,stroke:#0277bd')
    mermaid.append('    style InfoNode fill:#fff3e0,stroke:#ffb74d,text-align:left')

    return "\n".join(mermaid)

def main():
    parser = argparse.ArgumentParser(formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument("-f", "--file", type=str, help="Path to config file")
    parser.add_argument("-i", "--interface", type=str, help="Target interface")
    
    if len(sys.argv) == 1:
        print_banner()
        parser.print_help()
        sys.exit(1)

    args = parser.parse_args()
    if not args.file or not os.path.exists(args.file): sys.exit(f"Error: File {args.file} not found")
    if not args.interface: sys.exit("Error: Interface required")

    try:
        with open(args.file, 'r', encoding='utf-8') as f: content = f.read()
    except Exception as e: sys.exit(f"Error reading file: {e}")

    print_banner()
    print(f"Target: {args.interface} in {args.file}")
    print("-" * 60)
    
    res = generate_diagram(content, args.interface)
    if res.startswith("Error"): print(res)
    else:
        print("\nCopy below to Mermaid Live Editor:\n")
        print("```mermaid")
        print(res)
        print("```")

if __name__ == "__main__":
    main()