const mime = require('mime-types');


const fileName = 'Te.txt';
const mimeType = mime.lookup(fileName);

console.log(mimeType);

