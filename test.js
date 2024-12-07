const a = "Ym9iQGR5bGFuLmNvbTp0b3RvMTIzNCE=";
const credentials = Buffer.from(a, 'base64').toString('utf-8');
const [email, password] = credentials.split(':');

console.log("email:", email, "password:", password);
