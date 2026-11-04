const {Donation,Receipt,Campaign}=require("../models");
const {createDonation,confirmMockPayment,createReceiptPdf}=require("../services/donationService");
const {httpError}=require("../middleware/errors");
async function campaigns(_req,res,next){try{res.json({campaigns:await Campaign.find({active:true}).sort({createdAt:-1}).lean()});}catch(e){next(e);}}
async function create(req,res,next){try{const d=await createDonation(req.user,req.body);res.status(201).json({donation:d});}catch(e){next(e);}}
async function mockPay(req,res,next){try{const receipt=await confirmMockPayment(req.user,req.params.id);res.json({status:"paid",receipt:{id:receipt._id,receiptNo:receipt.receiptNo,pdfUrl:`/api/donations/receipts/${receipt._id}/pdf`}});}catch(e){next(e);}}
async function mine(req,res,next){try{const donations=await Donation.find({donor:req.user.id}).populate("campaign","title").sort({createdAt:-1}).lean();res.json({donations});}catch(e){next(e);}}
async function receiptPdf(req,res,next){try{const r=await Receipt.findById(req.params.id);if(!r) throw httpError(404,"Receipt not found","not_found");const d=await Donation.findById(r.donation);if(!d||String(d.donor)!==req.user.id) throw httpError(403,"Not allowed","forbidden");const pdf=await createReceiptPdf(r);res.set({"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${r.receiptNo.replaceAll("/","-")}.pdf"`});res.send(pdf);}catch(e){next(e);}}
module.exports={campaigns,create,mockPay,mine,receiptPdf};
