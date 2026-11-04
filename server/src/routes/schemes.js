const router=require("express").Router();
const c=require("../controllers/schemeController");
router.get("/",c.listSchemes);
router.post("/eligibility/check",c.checkEligibility);
router.get("/:code",c.getScheme);
module.exports=router;
