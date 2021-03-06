var input_pill = function ($parent) {
    // a dictionary of the key codes that are associated with each key
    // to make if/else more human readable.
    var KEY = {
        ENTER: 13,
        BACKSPACE: 8,
        LEFT_ARROW: 37,
        RIGHT_ARROW: 39,
    };

    // a stateful object of this `pill_container` instance.
    // all unique instance information is stored in here.
    var store = {
        pills: [],
        $parent: $parent,
        getKeyFunction: function () {},
        validation: function () {},
        lastUpdated: null,
        lastCreated: {
            keys: null,
            values: null,
        },
    };

    // a dictionary of internal functions. Some of these are exposed as well,
    // and nothing in here should be assumed to be private (due to the passing)
    // of the `this` arg in the `Function.prototype.bind` use in the prototype.
    var funcs = {
        // return the value of the contenteditable input form.
        value: function (input_elem) {
            return input_elem.innerText.trim();
        },

        // clear the value of the input form.
        clear: function (input_elem) {
            input_elem.innerText = "";
        },

        // create the object that will represent the data associated with a pill.
        // each can have a value and an optional key value.
        // the value is a human readable value that is shown, whereas the key
        // can be a hidden ID-type value.
        createPillObject: function (value, optionalKey) {
            // we need a "global" closure variable that will be flipped if the
            // key or pill creation was rejected.
            var rejected = false;

            var reject = function () {
                rejected = true;
            };

            // the user may provide a function to get a key from a value
            // that is entered, so return whatever value is gotten from
            // this function.
            // the default function is noop, so the return type is by
            // default `undefined`.
            if (typeof optionalKey === "undefined") {
                optionalKey = store.getKeyFunction(value, reject);

                if (typeof optionalKey === "object" &&
                    optionalKey.key !== undefined && optionalKey.value !== undefined) {
                        value = optionalKey.value;
                        optionalKey = optionalKey.key;
                    }
            }

            // now run a separate round of validation, in case they are using
            // `getKeyFunction` without `reject`, or not using it at all.
            store.validation(value, optionalKey, reject);

            // if the `rejected` global is now true, it means that the user's
            // created pill was not accepted, and we should no longer proceed.
            if (rejected) {
                store.$parent.find(".input").addClass("shake");
                return;
            }

            var id = Math.random().toString(16);

            var payload = {
                id: id,
                value: value,
                key: optionalKey,
            };

            store.pills.push(payload);

            return payload;
        },

        // the jQuery element representation of the data.
        createPillElement: function (payload) {
            store.lastUpdated = new Date();
            payload.$element = $("<div class='pill' data-id='" + payload.id + "' tabindex=0>" + payload.value + "<div class='exit'>&times;</div></div>");
            return payload.$element;
        },

        // this appends a pill to the end of the container but before the
        // input block.
        appendPill: function (value, optionalKey) {
            var payload = this.createPillObject(value, optionalKey);
            // if the pill object is undefined, then it means the pill was
            // rejected so we should return out of this.
            if (!payload) {
                return false;
            }
            var $pill = this.createPillElement(payload);

            store.$parent.find(".input").before($pill);
        },

        // this prepends a pill to the beginning of the container.
        prependPill: function (value, optionalKey) {
            var payload = this.createPillObject(value, optionalKey);
            if (!payload) {
                return false;
            }
            var $pill = this.createPillElement(payload);

            store.$parent.prepend($pill);
        },

        // this searches given a particlar pill ID for it, removes the node
        // from the DOM, removes it from the array and returns it.
        // this would generally be used for DOM-provoked actions, such as a user
        // clicking on a pill to remove it.
        removePill: function (id) {
            var idx;
            for (var x = 0; x < store.pills.length; x += 1) {
                if (store.pills[x].id === id) {
                    idx = x;
                }
            }

            if (typeof idx === "number") {
                store.pills[idx].$element.remove();
                store.lastUpdated = new Date();
                return store.pills.splice(idx, 1);
            }
        },

        // this will remove the last pill in the container -- by defaulat tied
        // to the "backspace" key when the value of the input is empty.
        removeLastPill: function () {
            var pill = store.pills.pop();
            store.lastUpdated = new Date();

            if (pill) {
                pill.$element.remove();
            }
        },

        removeAllPills: function () {
            while (store.pills.length > 0) {
                this.removeLastPill();
            }

            this.clear(store.$parent.find(".input"));
        },

        // returns all data of the pills exclusive of their elements.
        data: function () {
            return store.pills.map(function (pill) {
                return {
                    value: pill.value,
                    key: pill.key,
                };
            });
        },

        // returns all hidden keys.
        // IMPORTANT: this has a caching mechanism built in to check whether the
        // store has changed since the keys/values were last retrieved so that
        // if there are many successive pulls, it doesn't have to map and create
        // an array every time.
        // this would normally be a micro-optimization, but our codebase's
        // typeaheads will ask for the keys possibly hundreds or thousands of
        // times, so this saves a lot of time.
        keys: (function () {
            var keys = [];
            return function () {
                if (store.lastUpdated >= store.lastCreated.keys) {
                    keys = store.pills.map(function (pill) {
                        return pill.key;
                    });
                    store.lastCreated.keys = new Date();
                }

                return keys;
            };
        }()),

        // returns all human-readable values.
        values: function () {
            var values = [];
            return function () {
                if (store.lastUpdated >= store.lastCreated.values) {
                    values = store.pills.map(function (pill) {
                        return pill.value;
                    });
                    store.lastCreated.values = new Date();
                }

                return values;
            };
        },
    };

    (function events() {
        store.$parent.on("keydown", ".input", function (e) {
            var char = e.keyCode || e.charCode;

            if (char === KEY.ENTER) {
                // regardless of the value of the input, the ENTER keyword
                // should be ignored in favor of keeping content to one line
                // always.
                e.preventDefault();

                // if there is input, grab the input, make a pill from it,
                // and append the pill, then clear the input.
                if (funcs.value(e.target).length > 0) {
                    var value = funcs.value(e.target);

                    // append the pill and by proxy create the pill object.
                    var ret = funcs.appendPill(value);

                    // if the pill to append was rejected, no need to clear the
                    // input; it may have just been a typo or something close but
                    // incorrect.
                    if (ret !== false) {
                        // clear the input.
                        funcs.clear(e.target);
                        e.stopPropagation();
                    }
                }

                return;
            }

            // if the user backspaces and there is input, just do normal char
            // deletion, otherwise delete the last pill in the sequence.
            if (char === KEY.BACKSPACE && funcs.value(e.target).length === 0) {
                e.preventDefault();
                funcs.removeLastPill();

                return;
            }

            // if one is on the ".input" element and back/left arrows, then it
            // should switch to focus the last pill in the list.
            // the rest of the events then will be taken care of in the function
            // below that handles events on the ".pill" class.
            if (char === KEY.LEFT_ARROW) {
                if (window.getSelection().anchorOffset === 0) {
                    store.$parent.find(".pill").last().focus();
                }
            }
        });

        // handle events while hovering on ".pill" elements.
        // the three primary events are next, previous, and delete.
        store.$parent.on("keydown", ".pill", function (e) {
            var char = e.keyCode || e.charCode;

            var $pill = store.$parent.find(".pill:focus");

            if (char === KEY.LEFT_ARROW) {
                $pill.prev().focus();
            } else if (char === KEY.RIGHT_ARROW) {
                $pill.next().focus();
            } else if (char === KEY.BACKSPACE) {
                var $next = $pill.next();
                var id = $pill.data("id");
                funcs.removePill(id);
                $next.focus();
                // the "backspace" key in FireFox will go back a page if you do
                // not prevent it.
                e.preventDefault();
            }
        });

        // when the shake animation is applied to the ".input" on invalid input,
        // we want to remove the class when finished automatically.
        store.$parent.on("animationend", ".input", function () {
            $(this).removeClass("shake");
        });

        // when the "×" is clicked on a pill, it should delete that pill and then
        // select the next pill (or input).
        store.$parent.on("click", ".exit", function () {
            var $pill = $(this).closest(".pill");
            var $next = $pill.next();
            var id = $pill.data("id");

            funcs.removePill(id);
            $next.focus();
        });

        store.$parent.on("click", function (e) {
            if ($(e.target).is(".pill-container")) {
                $(this).find(".input").focus();
            }
        });
    }());

    // the external, user-accessible prototype.
    var prototype = {
        pill: {
            append: funcs.appendPill.bind(funcs),
            prepend: funcs.prependPill.bind(funcs),
            remove: funcs.removePill.bind(funcs),
        },

        data: funcs.data,
        keys: funcs.keys,
        values: funcs.values,

        onPillCreate: function (callback) {
            store.getKeyFunction = callback;
        },

        validate: function (callback) {
            store.validation = callback;
        },

        clear: funcs.removeAllPills.bind(funcs),
    };

    return prototype;
};

if (typeof module !== 'undefined') {
    module.exports = input_pill;
}
