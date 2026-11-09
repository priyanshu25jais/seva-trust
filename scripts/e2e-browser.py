"""Browser end-to-end check of the whole product, driven like a real user on a 390px phone.

Needs: pip install selenium, Firefox and geckodriver, and the server running with the built client
(SERVE_CLIENT=true) on a seeded database. It exits non-zero if any check fails and saves
screenshots to SHOTS_DIR.

  BASE_URL=http://localhost:4000 SHOTS_DIR=docs/screenshots python scripts/e2e-browser.py
Optional: FIREFOX_BIN=/path/to/firefox GECKODRIVER=/path/to/geckodriver
"""
import os, sys, time
from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys

BASE = os.environ.get("BASE_URL", "http://localhost:4200")
OUT = os.environ.get("SHOTS_DIR", "/tmp/shots")
os.makedirs(OUT, exist_ok=True)
opts = Options()
opts.add_argument("-headless")
if os.environ.get("FIREFOX_BIN"):
    opts.binary_location = os.environ["FIREFOX_BIN"]
service = Service(os.environ["GECKODRIVER"]) if os.environ.get("GECKODRIVER") else Service()
drv = webdriver.Firefox(options=opts, service=service)
drv.set_window_size(390, 900)
wait = WebDriverWait(drv, 15)
problems = []

def shot(name):
    time.sleep(0.4)
    drv.get_full_page_screenshot_as_file(f"{OUT}/{name}.png")
    print("shot", name)

def go(path):
    drv.get(BASE + path)

def xp(text, tag="*"):
    return f"//{tag}[normalize-space(.)='{text}' or contains(normalize-space(.), '{text}')]"

def click_text(text, tag="button"):
    el = wait.until(EC.element_to_be_clickable((By.XPATH, f"//{tag}[contains(normalize-space(.), '{text}')]")))
    drv.execute_script("arguments[0].scrollIntoView({block:'center'})", el)
    el.click()
    return el

def click_choice(text):
    el = wait.until(EC.element_to_be_clickable((By.XPATH, f"//label[contains(@class,'choice')][.//span[normalize-space(.)='{text}']]")))
    drv.execute_script("arguments[0].scrollIntoView({block:'center'})", el)
    el.click()
    return el

def type_into(label, value):
    el = wait.until(EC.presence_of_element_located((By.XPATH, f"//label[contains(normalize-space(.), '{label}')]")))
    inp = drv.find_element(By.ID, el.get_attribute("for"))
    inp.clear(); inp.send_keys(value)
    return inp

def check(cond, msg):
    if not cond:
        problems.append(msg); print("PROBLEM:", msg)

def text_present(t):
    return t in drv.find_element(By.TAG_NAME, "body").text

try:
    # ---- Home (Hindi, mobile)
    go("/")
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".scheme-card")))
    check(drv.execute_script("return document.documentElement.lang") == "hi", "html lang is not hi")
    check(drv.execute_script("return document.documentElement.scrollWidth <= window.innerWidth + 1"), "home scrolls sideways on 390px")
    shot("01_home_mobile")
    cards = drv.find_elements(By.CSS_SELECTOR, ".scheme-card")
    check(len(cards) == 10, f"expected 10 published schemes, saw {len(cards)}")
    click_text("पेंशन")
    time.sleep(0.8)
    check(len(drv.find_elements(By.CSS_SELECTOR, ".scheme-card")) < 10, "need filter did not narrow results")

    # ---- Scheme detail
    go("/schemes/SCH-014")
    wait.until(EC.presence_of_element_located((By.TAG_NAME, "article")))
    check(text_present("आधिकारिक स्रोत"), "source link missing on scheme page")
    check(text_present("अंतिम जाँच"), "last-checked date missing")
    shot("02_scheme_mobile")

    # ---- Campaign page
    go("/campaigns/widow-support")
    wait.until(EC.presence_of_element_located((By.XPATH, "//h1[contains(., 'विधवा सहायता कोष')]")))
    link = drv.find_element(By.XPATH, "//a[contains(., 'इस काम के लिए दान करें')]")
    check("campaign=widow-support" in link.get_attribute("href"), "campaign donate link does not carry the campaign")
    shot("02b_campaign_page")

    # ---- Finder: widow, 50, BPL yes
    go("/finder")
    wait.until(EC.presence_of_element_located((By.XPATH, "//button[contains(., 'सवाल शुरू करें')]")))
    shot("03_finder_intro")
    click_text("सवाल शुरू करें")
    click_choice("हाँ, मैं महिला हूँ")
    inp = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[inputmode='numeric']")))
    shot("04_finder_age")
    inp.send_keys("50"); inp.send_keys(Keys.ENTER)
    click_choice("विधवा")
    shot("05_finder_q4")
    click_choice("हाँ")
    click_choice("नहीं")   # pregnancy
    click_choice("हाँ")   # SHG member: the LAST answer must reach the server
    wait.until(EC.presence_of_element_located((By.XPATH, "//*[contains(text(),'संभावित')]")))
    time.sleep(0.6)
    check(text_present("स्व-सहायता समूह ऋण सहायता"), "last finder answer (SHG member) was not used")
    check(text_present("राज्य विधवा पेंशन"), "finder did not match widow pension")
    check(text_present("इन नियमों से मिलान हुआ"), "rules used not shown")
    shot("06_finder_results")

    # ---- Donate: 3 steps, success
    go("/donate")
    wait.until(EC.presence_of_element_located((By.XPATH, "//h1[contains(., 'राशि')]")))
    shot("07_donate_step1")
    click_choice("₹1,000")
    click_text("आगे")
    wait.until(EC.presence_of_element_located((By.XPATH, "//h1[contains(., 'आपकी जानकारी')]")))
    click_text("आगे")  # empty: must show errors
    time.sleep(0.3)
    check(text_present("अपना पूरा नाम लिखें"), "no inline error for empty name")
    shot("08_donate_step2_errors")
    type_into("पूरा नाम", "Anita Sharma")
    type_into("ईमेल", "anita@example.test")
    type_into("पैन", "abcde1234f")
    click_text("आगे")
    wait.until(EC.presence_of_element_located((By.XPATH, "//h1[contains(., 'भुगतान')]")))
    type_into("कार्ड नंबर", "4000000000000003")
    type_into("समाप्ति", "1230")
    type_into("सीवीवी", "123")
    shot("09_donate_step3")
    click_text("दान करें", "button")
    wait.until(EC.presence_of_element_located((By.XPATH, "//*[contains(text(),'विदेशी कार्ड स्वीकार नहीं')]")))
    check(text_present("एफसीआरए"), "FCRA notice missing")
    shot("10_donate_foreign_blocked")
    num = type_into("कार्ड नंबर", "")
    num.send_keys("4111111111111111")
    click_text("दान करें", "button")
    wait.until(EC.presence_of_element_located((By.XPATH, "//h1[contains(., 'धन्यवाद')]")))
    time.sleep(0.5)
    check(text_present("80G/"), "receipt number not shown")
    check("ABCDE1234F" not in drv.find_element(By.TAG_NAME, "body").text, "full PAN visible on success page")
    shot("11_donation_done")
    done_url = drv.current_url

    # ---- Login as donor, history
    go("/login")
    type_into("ईमेल", "donor@seva.test")
    type_into("पासवर्ड", "DemoPass123")
    click_text("लॉगिन करें")
    wait.until(EC.presence_of_element_located((By.XPATH, "//h1[contains(., 'मेरे दान')]")))
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "ul li.card")))
    shot("12_account")

    # ---- Admin
    drv.execute_script("localStorage.clear()")
    go("/login")
    type_into("ईमेल", "admin@seva.test")
    type_into("पासवर्ड", "DemoPass123")
    click_text("लॉगिन करें")
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "table.data")))
    shot("13_admin_list")
    link = wait.until(EC.element_to_be_clickable((By.XPATH, "//a[contains(., 'SCH-072')]")))
    link.click()
    wait.until(EC.presence_of_element_located((By.XPATH, "//h2[contains(., 'हिंदी सारांश')]")))
    shot("14_admin_editor")
    # AI summary (template fallback: no key configured)
    ta = drv.find_element(By.XPATH, "//label[contains(., 'आधिकारिक सूचना का पाठ')]/following-sibling::textarea")
    ta.send_keys("Self-help group members aged 18 to 60 receive three days of free training and a certificate from the block livelihood mission.")
    click_text("हिंदी सारांश का ड्राफ्ट बनाएँ")
    wait.until(EC.presence_of_element_located((By.XPATH, "//*[contains(text(),'सारांश स्वीकृत करें')]")))
    time.sleep(0.5)
    check(text_present("AI अभी उपलब्ध नहीं था"), "fallback notice not shown")
    shot("15_admin_summary_draft")
    go("/admin/reports")
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "table.data")))
    shot("16_admin_reports")

    # ---- English, desktop
    drv.set_window_size(1280, 900)
    go("/")
    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".scheme-card")))
    click_text("English")
    time.sleep(0.6)
    check(drv.execute_script("return document.documentElement.lang") == "en", "language toggle did not set lang=en")
    check(text_present("Which government schemes can you use?"), "English headline missing")
    shot("17_home_desktop_en")
finally:
    drv.quit()
    print("PROBLEMS:", problems if problems else "none")
    if problems:
        sys.exit(1)
