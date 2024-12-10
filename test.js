const sha1 = require('sha1');
const {v4: uuidv4} = require('uuid');

const user = {
	email: 'bob@dylan.com',
	password: 'toto1234!',
};

let p = Buffer.from(`${user.email}:${user.password}`).toString('base64')
console.log(p);

const a = sha1(user.password);
console.log(a);

p = Buffer.from(`${user.email}:${user.password}`).toString('utf-8')
console.log(p);

const b = uuidv4();
console.log(typeof(b));
