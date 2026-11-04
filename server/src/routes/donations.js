const router=require("express").Router();
const c=require("../controllers/donationController");
const {requireAuth}=require("../middleware/auth");
router.get("/campaigns",c.campaigns);
router.post("/",requireAuth,c.create);
router.post("/:id/mock-payment",requireAuth,c.mockPay);
router.get("/mine",requireAuth,c.mine);
router.get("/receipts/:id/pdf",requireAuth,c.receiptPdf);
module.exports=router;
