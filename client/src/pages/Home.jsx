import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const copy = {
  hi: {
    eyebrow: "सेवा ट्रस्ट • भोपाल, मध्य प्रदेश", title: "सही सहायता तक पहुँचें।", subtitle: "महिलाओं के लिए सरकारी योजनाएँ खोजें और भरोसे के साथ सामाजिक बदलाव में योगदान दें।",
    schemes: "योजनाएँ खोजें", donate: "दान करें", explore: "उपलब्ध योजनाएँ", finder: "योजना पात्रता जाँचें", finderText: "कुछ आसान सवालों के जवाब दें। हम संभावित रूप से उपयुक्त योजनाएँ दिखाएँगे।",
    district: "जिला", age: "उम्र", need: "सहायता का प्रकार", all: "सभी", pension: "पेंशन", livelihood: "आजीविका", health: "स्वास्थ्य", check: "संभावित योजनाएँ देखें", loading: "लोड हो रहा है…", error: "योजनाएँ लोड नहीं हो सकीं। सर्वर चालू है?", possible: "संभावित मिलान", noResults: "इस जानकारी के आधार पर कोई संभावित मिलान नहीं मिला।", disclaimer: "यह केवल शुरुआती जानकारी है, सरकारी पात्रता की पुष्टि नहीं।", learn: "विवरण देखें", footer: "जानकारी संबंधित विभाग से सत्यापित करें।"
  },
  en: {
    eyebrow: "SEVA TRUST • BHOPAL, MADHYA PRADESH", title: "Find the support you deserve.", subtitle: "Explore welfare schemes for women and contribute to meaningful community change.",
    schemes: "Explore schemes", donate: "Donate", explore: "Explore available schemes", finder: "Check scheme eligibility", finderText: "Answer a few simple questions to see schemes that may fit your situation.",
    district: "District", age: "Age", need: "Area of support", all: "All", pension: "Pension", livelihood: "Livelihood", health: "Health", check: "Find possible matches", loading: "Loading…", error: "Could not load schemes. Is the API running?", possible: "Possible match", noResults: "No possible matches found for these answers.", disclaimer: "Initial screening only; this is not an official eligibility decision.", learn: "View details", footer: "Please verify details with the responsible department."
  }
};
const districts = ["Bhopal", "Indore", "Jabalpur", "Gwalior", "Sagar"];
const labels = { Pension: "पेंशन", Livelihood: "आजीविका", Health: "स्वास्थ्य" };

export default function Home() {
  const { i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "hi";
  const t = copy[lang];
  const [schemes, setSchemes] = useState([]);
  const [need, setNeed] = useState("");
  const [district, setDistrict] = useState("Bhopal");
  const [age, setAge] = useState("30");
  const [gender, setGender] = useState("female");
  const [maritalStatus, setMaritalStatus] = useState("widow");
  const [documents, setDocuments] = useState(["bpl_card", "registered_shg_membership", "antenatal_registration"]);
  const [matches, setMatches] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/schemes?lang=${lang}`).then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => setSchemes(data.schemes || [])).catch(() => setError(t.error));
  }, [lang, t.error]);

  const visible = useMemo(() => schemes.filter((s) => !need || s.need === need), [schemes, need]);
  async function findMatches(event) {
    event.preventDefault(); setBusy(true); setMatches(null);
    try {
      const response = await fetch("/api/schemes/eligibility/check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ age, district, lang, answers: { gender, maritalStatus, documents } })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Request failed");
      setMatches(data.results || []);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function toggleLanguage() { i18n.changeLanguage(lang === "hi" ? "en" : "hi"); }

  return <div className="site-shell">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark">स</span><span>सेवा ट्रस्ट<small>साथ, सम्मान और सशक्तिकरण</small></span></a>
      <nav><a href="#schemes">{t.schemes}</a><a href="#finder">{t.finder}</a><a className="nav-donate" href="#donate">{t.donate}</a></nav>
      <button className="language" onClick={toggleLanguage}>{lang === "hi" ? "EN" : "हिंदी"}</button>
    </header>
    <main>
      <section className="hero"><div className="hero-copy"><span className="eyebrow">{t.eyebrow}</span><h1>{t.title}</h1><p>{t.subtitle}</p><div className="hero-actions"><a className="primary-btn" href="#finder">{t.finder}</a><a className="text-link" href="#schemes">{t.schemes} ↗</a></div></div>
        <div className="hero-art"><div className="sun"></div><div className="hero-note"><span>✦</span><strong>हर महिला के लिए</strong><small>एक बेहतर अवसर</small></div><div className="art-leaf leaf-one"></div><div className="art-leaf leaf-two"></div></div>
      </section>
      <section className="finder-section" id="finder"><div className="section-heading"><span className="eyebrow">01 / सहायता खोजें</span><h2>{t.finder}</h2><p>{t.finderText}</p></div>
        <form className="finder-card" onSubmit={findMatches}><div className="form-grid">
          <label>{t.district}<select value={district} onChange={e=>setDistrict(e.target.value)}>{districts.map(d=><option key={d}>{d}</option>)}</select></label>
          <label>{t.age}<input type="number" min="1" max="120" required value={age} onChange={e=>setAge(e.target.value)}/></label>
          <label>{lang === "hi" ? "वैवाहिक स्थिति" : "Marital status"}<select value={maritalStatus} onChange={e=>setMaritalStatus(e.target.value)}><option value="widow">{lang==="hi"?"विधवा":"Widowed"}</option><option value="married">{lang==="hi"?"विवाहित":"Married"}</option><option value="single">{lang==="hi"?"अविवाहित":"Single"}</option></select></label>
          <label>{lang === "hi" ? "लिंग" : "Gender"}<select value={gender} onChange={e=>setGender(e.target.value)}><option value="female">{lang==="hi"?"महिला":"Female"}</option><option value="other">{lang==="hi"?"अन्य":"Other"}</option></select></label>
        </div><fieldset><legend>{lang==="hi"?"आपके पास कौन से दस्तावेज़ हैं?":"Which documents do you have?"}</legend>{[["bpl_card","BPL card / बीपीएल कार्ड"],["registered_shg_membership","SHG membership / समूह सदस्यता"],["antenatal_registration","Health registration / स्वास्थ्य पंजीकरण"]].map(([v,l])=><label className="check" key={v}><input type="checkbox" checked={documents.includes(v)} onChange={e=>setDocuments(old=>e.target.checked?[...old,v]:old.filter(x=>x!==v))}/>{l}</label>)}</fieldset>
        <button className="primary-btn" disabled={busy}>{busy?t.loading:t.check}</button>
        {matches && <div className="match-results"><h3>{t.possible} ({matches.length})</h3>{matches.length===0?<p>{t.noResults}</p>:matches.map(m=><article className="match-item" key={m.code}><strong>{m.title}</strong><p>{m.benefit}</p><small>{m.code} · {m.need}</small></article>)}<p className="disclaimer">{t.disclaimer}</p></div>}
        </form>
      </section>
      <section className="schemes-section" id="schemes"><div className="section-heading"><span className="eyebrow">02 / जानकारी और अवसर</span><h2>{t.explore}</h2></div><div className="filter-row"><button className={!need?"filter active":"filter"} onClick={()=>setNeed("")}>{t.all}</button>{["Pension","Livelihood","Health"].map(n=><button key={n} className={need===n?"filter active":"filter"} onClick={()=>setNeed(n)}>{lang==="hi"?labels[n]:n}</button>)}</div>
        {error && <p className="error">{error}</p>}<div className="scheme-grid">{visible.map((s,i)=><article className="scheme-card" key={s.code}><div className={`scheme-icon icon-${i%3}`}>{["♡","✿","✚"][i%3]}</div><span className="scheme-type">{lang==="hi"?labels[s.need]:s.need}</span><h3>{s.title}</h3><p>{s.benefit}</p><div className="scheme-foot"><span>{s.code}</span><a href={`#finder`}>{t.learn} ↗</a></div></article>)}</div>
      </section>
      <section className="donate-banner" id="donate"><div><span className="eyebrow">03 / बदलाव में भागीदार बनें</span><h2>{lang==="hi"?"आपका सहयोग, किसी की नई शुरुआत।":"Your support can create a new beginning."}</h2><p>{lang==="hi"?"दान सुविधा जल्द उपलब्ध होगी।":"Donation checkout is the next implementation phase."}</p></div><span className="banner-flower">✳</span></section>
    </main>
    <footer><span>© Seva Trust · Bhopal</span><span>{t.footer}</span></footer>
  </div>;
}
