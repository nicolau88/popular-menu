const fs = require('fs');
fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vQae4azVxGxHwSNGEcqoMUia0sNSykZxGA0koTpJ2SRcihjopNGaVAIlm2MjOhbxgmU6Y05e0ffzNVB/pub?output=csv')
  .then(r => r.text())
  .then(t => {
     let lines = t.split('\n');
     console.log("HEADERS:", lines[0]);
     let jamon = lines.find(l => l.toLowerCase().includes('jamon') || l.toLowerCase().includes('jamón'));
     console.log("JAMON:", jamon);
  });
