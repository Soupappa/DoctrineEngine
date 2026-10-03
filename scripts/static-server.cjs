const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 5174);
const root = path.resolve(__dirname, "..", "dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8"
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url === "/" ? "/index.html" : req.url || "/index.html");
    const filePath = path.join(root, urlPath);
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Doctrine Engine static server on http://127.0.0.1:${port}`);
  });
