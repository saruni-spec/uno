require("dotenv").config();

const express = require("express");
const cors = require("cors");
const routes = require("./routes");

const app = express();
const port = Number(process.env.API_PORT || 4000);

app.use(
  cors({
    origin: true,
    credentials: false,
  }),
);
app.use(express.json({ limit: "1mb" }));

app.use("/api", routes);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
