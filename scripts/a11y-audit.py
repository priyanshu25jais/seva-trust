"""Automated accessibility audit (axe-core, WCAG 2.1 A and AA rules) of the key pages.
Not a substitute for manual testing with a screen reader.

  npm install axe-core --prefix /tmp/axe      # or any folder
  AXE_PATH=/tmp/axe/node_modules/axe-core/axe.min.js BASE_URL=http://localhost:4000 python scripts/a11y-audit.py
Optional: FIREFOX_BIN, GECKODRIVER
"""
import json, time, os
from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE=os.environ.get("BASE_URL","http://localhost:4000")
AXE=os.environ.get("AXE_PATH","node_modules/axe-core/axe.min.js")
axe_src=open(AXE).read()
opts=Options()
opts.add_argument("-headless")
if os.environ.get("FIREFOX_BIN"):
    opts.binary_location=os.environ["FIREFOX_BIN"]
service=Service(os.environ["GECKODRIVER"]) if os.environ.get("GECKODRIVER") else Service()
drv=webdriver.Firefox(options=opts, service=service)
drv.set_window_size(390, 900)
wait=WebDriverWait(drv,15)
results={}

def audit(name):
    time.sleep(0.8)
    drv.execute_script(axe_src)
    res=drv.execute_async_script("""
      const done=arguments[arguments.length-1];
      axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}).then(r=>done({violations:r.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.map(n=>n.target.join(' ')).slice(0,4)})),passes:r.passes.length}));
    """)
    results[name]=res
    print(name, "violations:", len(res['violations']), "passes:", res['passes'])
    for v in res['violations']:
        print("   -", v['impact'], v['id'], v['help'], v['nodes'])

def go(p): drv.get(BASE+p)
def login(email):
    drv.execute_script("localStorage.clear()")
    go("/login")
    for label,val in (("ईमेल",email),("पासवर्ड","DemoPass123")):
        el=wait.until(EC.presence_of_element_located((By.XPATH,f"//label[contains(.,'{label}')]")))
        inp=drv.find_element(By.ID, el.get_attribute("for")); inp.send_keys(val)
    drv.find_element(By.XPATH,"//button[contains(.,'लॉगिन करें')]").click()

go("/"); wait.until(EC.presence_of_element_located((By.CSS_SELECTOR,".scheme-card"))); audit("home (hi)")
go("/schemes/SCH-014"); wait.until(EC.presence_of_element_located((By.TAG_NAME,"article"))); audit("scheme detail (hi)")
go("/finder"); wait.until(EC.presence_of_element_located((By.TAG_NAME,"h1"))); audit("finder intro (hi)")
drv.find_element(By.XPATH,"//button[contains(.,'सवाल शुरू करें')]").click(); time.sleep(0.5); audit("finder question (hi)")
go("/donate"); wait.until(EC.presence_of_element_located((By.XPATH,"//h1[contains(.,'राशि')]"))); audit("donate step 1 (hi)")
go("/login"); wait.until(EC.presence_of_element_located((By.TAG_NAME,"form"))); audit("login (hi)")
go("/privacy"); wait.until(EC.presence_of_element_located((By.TAG_NAME,"h1"))); audit("privacy (hi)")
go("/"); wait.until(EC.presence_of_element_located((By.CSS_SELECTOR,".scheme-card")))
drv.find_element(By.XPATH,"//button[contains(.,'English')]").click(); time.sleep(0.6); audit("home (en)")
drv.execute_script("localStorage.clear()")
login("admin@seva.test"); wait.until(EC.presence_of_element_located((By.CSS_SELECTOR,"table.data"))); audit("admin schemes")
drv.find_element(By.XPATH,"//a[contains(.,'SCH-072')]").click(); wait.until(EC.presence_of_element_located((By.TAG_NAME,"form"))); audit("admin editor")
go("/admin/reports"); wait.until(EC.presence_of_element_located((By.CSS_SELECTOR,"table.data"))); audit("admin reports")
drv.set_window_size(1280,900); go("/"); wait.until(EC.presence_of_element_located((By.CSS_SELECTOR,".scheme-card"))); audit("home desktop")
drv.quit()
os.makedirs('docs/audit',exist_ok=True)
json.dump(results, open('docs/audit/axe-results.json','w'), indent=1)
total=sum(len(r['violations']) for r in results.values())
print("TOTAL violations:", total)
