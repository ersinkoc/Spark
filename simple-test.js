const { Spark } = require('./src/index');

const app = new Spark();

console.log('Router stack before adding route:', app.router.stack.length);

app.get('/', (ctx) => {
  console.log('Route handler called!');
  ctx.json({ message: 'Hello from Spark!' });
});

console.log('Router stack after adding route:', app.router.stack.length);
console.log('Route details:', app.router.stack[0]);

app.listen(3001, () => {
  console.log('Server started on port 3001');
  console.log('Test: curl http://localhost:3001/');
});