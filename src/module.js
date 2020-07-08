module.exports = {
    title: "common functions",
    debounce: function(fn) {
        let timeout = null;
        return function() {
            clearTimeout(timeout)
            timeout = setTimeout(() => {
                fn.apply(this, arguments)
            }, 300)
        }
    }
}