const Scheme = require("../models/Scheme");
const { httpError } = require("../middleware/errors");

const text = (value, lang = "hi") => typeof value === "string" ? value : (value?.[lang] || value?.en || value?.hi || "");
const card = (s, lang) => ({ id:s._id, code:s.code, title:text(s.title,lang), need:s.need, districts:s.districts, benefit:text(s.benefit,lang), whoCanApply:text(s.whoCanApply,lang), summary:s.summaryStatus==="approved" ? s.summaryHi : "", sourceUrl:s.sourceUrl, lastChecked:s.lastChecked });

async function listSchemes(req,res,next) {
  try {
    const filter={status:"published"};
    if(req.query.need) filter.need=req.query.need;
    if(req.query.district) filter.districts=req.query.district;
    const docs=await Scheme.find(filter).sort({need:1,code:1}).lean();
    res.json({schemes:docs.map(s=>card(s,req.query.lang||"hi"))});
  } catch(e){next(e);}
}
async function getScheme(req,res,next) {
  try {
    const s=await Scheme.findOne({code:req.params.code.toUpperCase(),status:"published"}).lean();
    if(!s) throw httpError(404,"Scheme not found","not_found");
    const lang=req.query.lang||"hi";
    res.json({scheme:{...card(s,lang),documents:(s.documents||[]).map(x=>text(x,lang)),howToApply:text(s.howToApply,lang),helpCentre:s.helpCentre,eligibility:s.eligibility}});
  } catch(e){next(e);}
}
function evaluate(rule={},a={}) {
  const reasons=[],missing=[];
  for(const key of ["gender","maritalStatus","occupation"]) if(rule[key] && a[key]!==rule[key]) reasons.push(key);
  if(rule.minAge && a.age<rule.minAge) reasons.push("age");
  if(rule.maxAge && a.age>rule.maxAge) reasons.push("age");
  for(const key of ["pregnancy","firstChild","rural"]) if(rule[key] && a[key]!==true) reasons.push(key);
  if(rule.minDisabilityPercent && Number(a.disabilityPercent||0)<rule.minDisabilityPercent) reasons.push("disabilityPercent");
  for(const d of rule.requires||[]) if(!(a.documents||[]).includes(d)) missing.push(d);
  return {matched:!reasons.length&&!missing.length,reasons,missingDocuments:missing};
}
async function checkEligibility(req,res,next) {
  try {
    const age=Number(req.body.age), district=String(req.body.district||"");
    if(!Number.isInteger(age)||age<1||age>120||!district) throw httpError(400,"Enter a valid age and district","validation_error");
    const docs=await Scheme.find({status:"published",districts:district}).lean();
    const results=docs.map(s=>({...card(s,req.body.lang||"hi"),...evaluate(s.eligibility,{...req.body.answers,age})})).filter(x=>x.matched);
    res.json({disclaimer:"Initial screening only. The responsible department makes the final eligibility decision.",results});
  } catch(e){next(e);}
}
module.exports={listSchemes,getScheme,checkEligibility};
