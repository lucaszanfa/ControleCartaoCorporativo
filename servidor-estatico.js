const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = 8080;
const host = "0.0.0.0";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

const server = http.createServer((request, response) => {
  let pathname = decodeURIComponent(request.url.split("?")[0]);

  if (pathname === "/") {
    pathname = "/login.html";
  }

  const filePath = path.join(root, pathname);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Acesso negado");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Arquivo não encontrado");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream"
    });
    response.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
  console.log(`Na rede, acesse usando o IP desta máquina e a porta ${port}.`);
});
