import dotenv from "dotenv";
import { createApp } from "./app.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

const app = createApp();
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
