# Micro

## Usage

```javascript
const Micro = require("@shitcloud/micro");
const micro = new Micro("example");

micro.sub("topic", (ctx) => {
  console.log(ctx.params);
});

micro.pub("topic", { foo: "bar" });

micro.cmd("command", (ctx) => {
  console.log(ctx.params);

  ctx.reply("reply");
});

micro.call("command", { hello: "world" });
```
