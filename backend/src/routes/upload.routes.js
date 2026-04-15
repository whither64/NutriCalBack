import express from "express";
import { upload } from "../middleware/upload.js";
import { uploadFile } from "../services/s3.js";

const router = express.Router();

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const url = await uploadFile(req.file);
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: "Error uploading file" });
  }
});

export default router;