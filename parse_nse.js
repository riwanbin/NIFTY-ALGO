const fs = require('fs');

function parseNumber(val) {
    if (val === '-' || !val) {
        return 0;
    }
    try {
        const parsed = parseFloat(val.replace(/,/g, ''));
        return isNaN(parsed) ? 0 : parsed;
    } catch (e) {
        return 0;
    }
}

try {
    const data = fs.readFileSync('raw_nse_data.txt', 'utf8');
    const lines = data.split('\n');
    
    const records = [];
    
    for (const line of lines) {
        if (line.startsWith('Calls chart for row')) {
            const parts = line.trim().split('\t');
            if (parts.length >= 22) {
                const strike = parseNumber(parts[11]);
                const call_oi = parseNumber(parts[1]);
                const put_oi = parseNumber(parts[21]);
                
                records.push({
                    strikePrice: strike,
                    CE: { openInterest: call_oi },
                    PE: { openInterest: put_oi }
                });
            }
        }
    }
    
    const output = {
        records: {
            data: records
        }
    };
    
    fs.writeFileSync('parsed_nse.json', JSON.stringify(output, null, 2));
    console.log('Successfully parsed ' + records.length + ' records into parsed_nse.json');
} catch (err) {
    console.error('Error parsing data:', err);
}
