const mongoose=require("mongoose");
const {Donation,Campaign,Receipt,Counter}=require("../models");
const {httpError}=require("../middleware/errors");
const {env}=require("../config/env");
const PDFDocument=require("pdfkit");
const path=require("path");

function financialYear(date) {
  const y=date.getFullYear(), start=date.getMonth()>=3?y:y-1;
  return `${start}-${String(start+1).slice(-2)}`;
}
async function createDonation(user, input) {
  const amount=Number(input.amount);
  if(!Number.isInteger(amount)||amount<1||amount>1000000) throw httpError(400,"Donation amount must be a whole number between 1 and 10,00,000","validation_error");
  if(!input.idempotencyKey || input.idempotencyKey.length<12 || input.idempotencyKey.length>100) throw httpError(400,"A valid idempotency key is required","validation_error");
  const campaign=await Campaign.findOne({_id:input.campaign,active:true});
  if(!campaign) throw httpError(404,"Active campaign not found","not_found");
  const existing=await Donation.findOne({idempotencyKey:input.idempotencyKey});
  if(existing) {
    if(String(existing.donor)!==String(user.id)) throw httpError(409,"Idempotency key already used","conflict");
    return existing;
  }
  return Donation.create({
    donor:user.id,campaign:campaign._id,amount,type:input.type==="monthly"?"monthly":"one-time",
    status:"pending",idempotencyKey:input.idempotencyKey,
    donorName:String(input.donorName||"").trim(),donorEmail:String(input.donorEmail||"").toLowerCase().trim(),
    donorPan:input.donorPan?String(input.donorPan).toUpperCase().trim():undefined
  });
}
async function confirmMockPayment(user,donationId) {
  const session=await mongoose.startSession();
  let receipt;
  try {
    await session.withTransaction(async()=>{
      const donation=await Donation.findOne({_id:donationId,donor:user.id}).session(session);
      if(!donation) throw httpError(404,"Donation not found","not_found");
      if(donation.status==="failed") throw httpError(409,"Failed donation cannot be confirmed","conflict");
      if(donation.status==="paid") {
        receipt=await Receipt.findOne({donation:donation._id}).session(session);
        return;
      }
      const now=new Date(), fy=financialYear(now), key=`receipt-${fy}`;
      const counter=await Counter.findOneAndUpdate({key},{$inc:{seq:1}},{new:true,upsert:true,session});
      const receiptNo=`SEVA/${fy}/${String(counter.seq).padStart(6,"0")}`;
      donation.status="paid"; await donation.save({session});
      const campaign=await Campaign.findById(donation.campaign).session(session);
      const snapshot={donorName:donation.donorName,donorPan:donation.donorPan,amount:donation.amount,date:now,campaignTitle:campaign?.title?.en||"Seva Trust Campaign"};
      [receipt]=await Receipt.create([{receiptNo,financialYear:fy,donation:donation._id,snapshot}],{session});
    });
    return receipt;
  } finally { await session.endSession(); }
}
async function createReceiptPdf(receipt) {
  const doc=new PDFDocument({size:"A4",margin:55});
  const chunks=[];
  doc.on("data",c=>chunks.push(c));
  const done=new Promise((resolve,reject)=>{doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject);});
  const font=path.join(__dirname,"../assets/fonts/NotoSansDevanagari-VariableFont_wdth,wght.ttf");
  try { doc.font(font); } catch { doc.font("Helvetica"); }
  doc.fontSize(22).text(env.TRUST_NAME,{align:"center"});
  doc.moveDown(.4).fontSize(16).text("Donation Receipt / दान रसीद",{align:"center"});
  doc.moveDown().fontSize(11);
  const s=receipt.snapshot;
  doc.text(`Receipt No: ${receipt.receiptNo}`);
  doc.text(`Date: ${new Date(s.date).toLocaleDateString("en-IN")}`);
  doc.moveDown();
  doc.text(`Donor: ${s.donorName}`);
  doc.text(`PAN: ${s.donorPan||"Not provided"}`);
  doc.text(`Campaign: ${s.campaignTitle}`);
  doc.text(`Donation amount: INR ${s.amount.toLocaleString("en-IN")}`);
  doc.moveDown(2).fontSize(9).text(`Trust PAN: ${env.TRUST_PAN}`);
  doc.text(`80G reference: ${env.TRUST_80G_NUMBER}`);
  doc.moveDown().text("Demo receipt for this application. Tax deductibility and certificate validity must be confirmed by the trust.");
  doc.end();
  return done;
}
module.exports={createDonation,confirmMockPayment,createReceiptPdf};
