function assert(value) {
  if (this == window)
    return new assert(value);
  this.value = value;
}
assert.prototype = {
  "equals": function (val, message) {
    equals(this.value, val, message);
  },
  "same": function (val, message) {
    same(this.value, val, message);
  }
};