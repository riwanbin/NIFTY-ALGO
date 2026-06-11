import json
import sys

def parse_number(val):
    if val == '-' or not val:
        return 0
    try:
        return float(val.replace(',', ''))
    except:
        return 0

with open('raw_nse_data.txt', 'r') as f:
    lines = f.readlines()

records = []
for line in lines:
    if line.startswith('Calls chart for row'):
        parts = line.strip().split('\t')
        if len(parts) >= 21:
            try:
                # Column indices (based on provided mapping):
                # 0: 'Calls chart for row X'
                # 1: Call OI
                # 11: Strike
                # 21: Put OI
                
                strike = parse_number(parts[11])
                call_oi = parse_number(parts[1])
                put_oi = parse_number(parts[21])
                
                records.append({
                    "strikePrice": strike,
                    "CE": { "openInterest": call_oi },
                    "PE": { "openInterest": put_oi }
                })
            except Exception as e:
                pass

output = {
    "records": {
        "data": records
    }
}

with open('parsed_nse.json', 'w') as f:
    json.dump(output, f, indent=2)

print(json.dumps(output, indent=2))
