/**
 * Created by Raykid on 2016/12/22.
 */
var ares;
(function (ares) {
    var Dep = (function () {
        function Dep() {
            this._map = {};
        }
        /**
         * 添加数据变更订阅者
         * @param watcher 数据变更订阅者
         */
        Dep.prototype.watch = function (watcher) {
            if (!this._map[watcher.uid]) {
                this._map[watcher.uid] = watcher;
            }
        };
        /**
         * 数据变更，通知所有订阅者
         * @param extra 可能的额外数据
         */
        Dep.prototype.notify = function (extra) {
            for (var uid in this._map) {
                var watcher = this._map[uid];
                watcher.update(extra);
            }
        };
        return Dep;
    })();
    ares.Dep = Dep;
})(ares || (ares = {}));
/**
 * Created by Raykid on 2016/12/22.
 * 数据更新订阅者，当依赖的数据有更新时会触发callback通知外面
 */
var ares;
(function (ares) {
    var Watcher = (function () {
        function Watcher(exp, scope, callback) {
            // 生成一个全局唯一的ID
            this._uid = Watcher._uid++;
            // 记录表达式和作用域
            this._exp = exp;
            this._scope = scope;
            // 将表达式和作用域解析为一个Function
            this._expFunc = ares.utils.createEvalFunc(exp);
            // 记录回调函数
            this._callback = callback;
            // 进行首次更新
            this.update();
        }
        Object.defineProperty(Watcher.prototype, "uid", {
            /** 获取Watcher的全局唯一ID */
            get: function () {
                return this._uid;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * 获取到表达式当前最新值
         * @returns {any} 最新值
         */
        Watcher.prototype.getValue = function () {
            var value = null;
            // 记录自身
            Watcher.updating = this;
            // 表达式求值
            try {
                value = this._expFunc(this._scope);
            }
            catch (err) {
                // 输出错误日志
                console.error("表达式求值错误，exp：" + this._exp + "，scope：" + JSON.stringify(this._scope));
            }
            // 移除自身记录
            Watcher.updating = null;
            return value;
        };
        /**
         * 当依赖的数据有更新时调用该方法
         * @param extra 可能的额外数据
         */
        Watcher.prototype.update = function (extra) {
            var value = this.getValue();
            if (!Watcher.isEqual(value, this._value)) {
                this._callback && this._callback(value, this._value, extra);
                this._value = Watcher.deepCopy(value);
            }
        };
        /**
         * 是否相等，包括基础类型和对象/数组的对比
         */
        Watcher.isEqual = function (a, b) {
            return (a == b || (Watcher.isObject(a) && Watcher.isObject(b)
                ? JSON.stringify(a) == JSON.stringify(b)
                : false));
        };
        /**
         * 是否为对象(包括数组、正则等)
         */
        Watcher.isObject = function (obj) {
            return (obj && typeof obj == "object");
        };
        /**
         * 复制对象，若为对象则深度复制
         */
        Watcher.deepCopy = function (from) {
            if (Watcher.isObject(from)) {
                // 复杂类型对象，先字符串化，再对象化
                return JSON.parse(JSON.stringify(from));
            }
            else {
                // 基本类型对象，直接返回之
                return from;
            }
        };
        /** 记录当前正在执行update方法的Watcher引用 */
        Watcher.updating = null;
        Watcher._uid = 0;
        return Watcher;
    })();
    ares.Watcher = Watcher;
})(ares || (ares = {}));
/// <reference path="Dep.ts"/>
/// <reference path="Watcher.ts"/>
/**
 * Created by Raykid on 2016/12/22.
 */
var ares;
(function (ares) {
    var Mutator = (function () {
        function Mutator() {
        }
        /**
         * 将用户传进来的数据“变异”成为具有截获数据变更能力的数据
         * @param data 原始数据
         * @returns {any} 变异后的数据
         */
        Mutator.mutate = function (data) {
            // 如果是简单类型，则啥也不做
            if (!data || typeof data != "object")
                return;
            // 是个复杂类型对象，针对每个内部变量都进行一次变异
            for (var key in data) {
                Mutator.mutateObject(data, key, data[key]);
            }
            return data;
        };
        Mutator.mutateObject = function (data, key, value) {
            // 对每个复杂类型对象都要有一个对应的依赖列表
            var dep = new ares.Dep();
            // 变异过程
            Object.defineProperty(data, key, {
                enumerable: true,
                configurable: false,
                get: function () {
                    // 如果Watcher.updating不是null，说明当前正在执行表达式，那么获取的变量自然是其需要依赖的
                    var watcher = ares.Watcher.updating;
                    if (watcher)
                        dep.watch(watcher);
                    // 利用闭包保存原始值
                    return value;
                },
                set: function (v) {
                    if (v == value)
                        return;
                    value = v;
                    // 如果是数组就走专门的数组变异方法，否则递归变异对象
                    if (Array.isArray(v))
                        Mutator.mutateArray(v, dep);
                    else
                        Mutator.mutate(v);
                    // 触发通知
                    dep.notify();
                }
            });
            // 递归变异
            Mutator.mutate(value);
        };
        Mutator.mutateArray = function (arr, dep) {
            // 变异当前数组
            arr["__proto__"] = Mutator.defineReactiveArray(dep);
            // 遍历当前数组，将内容对象全部变异
            for (var i = 0, len = arr.length; i < len; i++) {
                Mutator.mutate(arr[i]);
            }
        };
        Mutator.defineReactiveArray = function (dep) {
            var proto = Array.prototype;
            var result = Object.create(proto);
            // 遍历所有方法，一个一个地变异
            Mutator._arrMethods.forEach(function (method) {
                // 利用闭包记录一个原始方法
                var oriMethod = proto[method];
                // 开始变异
                Object.defineProperty(result, method, {
                    value: function () {
                        var args = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            args[_i - 0] = arguments[_i];
                        }
                        // 首先调用原始方法，获取返回值
                        var result = oriMethod.apply(this, args);
                        // 数组插入项
                        var inserted;
                        switch (method) {
                            case "push":
                            case "unshift":
                                inserted = args;
                                break;
                            case "splice":
                                inserted = args.slice(2);
                                break;
                        }
                        // 监视数组插入项，而不是重新监视整个数组
                        if (inserted && inserted.length) {
                            Mutator.mutateArray(inserted, dep);
                        }
                        // 触发更新
                        dep.notify({ method: args });
                        // 返回值
                        return result;
                    }
                });
            });
            // 提供替换数组设置的方法，因为直接设置数组下标的方式无法变异
            Object.defineProperty(result, "$set", {
                value: function (index, value) {
                    // 超出数组长度默认追加到最后
                    if (index >= this.length)
                        index = this.length;
                    return this.splice(index, 1, value)[0];
                }
            });
            // 提供替换数组移除的方法，因为直接移除的方式无法变异
            Object.defineProperty(result, "$remove", {
                value: function (item) {
                    var index = this.indexOf(item);
                    if (index > -1)
                        return this.splice(index, 1);
                    return null;
                }
            });
            return result;
        };
        // 记录数组中会造成数据更新的所有方法名
        Mutator._arrMethods = [
            "push",
            "pop",
            "unshift",
            "shift",
            "splice",
            "sort",
            "reverse"
        ];
        return Mutator;
    })();
    ares.Mutator = Mutator;
})(ares || (ares = {}));
/**
 * Created by Raykid on 2016/12/22.
 */
var ares;
(function (ares) {
    var utils;
    (function (utils) {
        /**
         * 创建一个表达式求值方法，用于未来执行
         * @param exp 表达式
         * @returns {Function} 创建的方法
         */
        function createEvalFunc(exp) {
            return Function("scope", "with(scope){return " + exp + "}");
        }
        utils.createEvalFunc = createEvalFunc;
        /**
         * 表达式求值，无法执行多条语句
         * @param exp 表达式
         * @param scope 表达式的作用域
         * @returns {any} 返回值
         */
        function evalExp(exp, scope) {
            return createEvalFunc(exp)(scope);
        }
        utils.evalExp = evalExp;
        /**
         * 创建一个执行方法，用于未来执行
         * @param exp 表达式
         * @returns {Function} 创建的方法
         */
        function createRunFunc(exp) {
            return Function("scope", "with(scope){" + exp + "}");
        }
        utils.createRunFunc = createRunFunc;
        /**
         * 直接执行表达式，不求值。该方法可以执行多条语句
         * @param exp 表达式
         * @param scope 表达式的作用域
         */
        function runExp(exp, scope) {
            createRunFunc(exp)(scope);
        }
        utils.runExp = runExp;
    })(utils = ares.utils || (ares.utils = {}));
})(ares || (ares = {}));
/// <reference path="Interfaces.ts"/>
/// <reference path="Mutator.ts"/>
/// <reference path="Utils.ts"/>
/**
 * Created by Raykid on 2016/12/16.
 */
var ares;
(function (ares) {
    /**
     * 将数据模型和视图进行绑定
     * @param model 数据模型
     * @param compiler 视图解析器，不同类型的视图需要使用不同的解析器解析后方可使用
     * @param options 一些额外参数
     * @returns {core.AresEntity} 绑定实体对象
     */
    function bind(data, compiler, options) {
        return new Ares(data, compiler, options);
    }
    ares.bind = bind;
    var Ares = (function () {
        function Ares(data, compiler, options) {
            // 判断DOM是否已经生成完毕
            if (document.body) {
                // 如果DOM已经生成完毕，则直接执行初始化
                this.doInited(data, compiler, options);
            }
            else {
                // 如果DOM还没生成完毕，则等待生成完毕后再执行初始化
                window.onload = this.doInited.bind(this, data, compiler, options);
            }
        }
        Object.defineProperty(Ares.prototype, "data", {
            /** 获取ViewModel */
            get: function () {
                return this._data;
            },
            enumerable: true,
            configurable: true
        });
        Ares.prototype.doInited = function (data, compiler, options) {
            // 记录变异对象
            this._data = ares.Mutator.mutate(data);
            this._compiler = compiler;
            this._options = options;
            // 初始化Compiler
            this._compiler.init(this);
            // 调用回调
            if (this._options && this._options.inited) {
                this._options.inited.call(this._data, this);
            }
        };
        Ares.prototype.createWatcher = function (exp, scope, callback) {
            return new ares.Watcher(exp, scope, callback);
        };
        return Ares;
    })();
    ares.Ares = Ares;
})(ares || (ares = {}));
/**
 * Created by Raykid on 2016/12/22.
 */
var ares;
(function (ares) {
    var html;
    (function (html) {
        html.commands = {
            /** 文本域命令 */
            textContent: function (context) {
                context.entity.createWatcher(context.exp, context.scope, function (value) {
                    context.target.nodeValue = value;
                });
            },
            /** 文本命令 */
            text: function (context) {
                context.entity.createWatcher(context.exp, context.scope, function (value) {
                    context.target.textContent = value;
                });
            },
            /** HTML文本命令 */
            html: function (context) {
                context.entity.createWatcher(context.exp, context.scope, function (value) {
                    var target = context.target;
                    target.innerHTML = value;
                    // 设置完成后需要重新编译一下当前节点的所有子节点
                    var children = target.childNodes;
                    for (var i = 0, len = children.length; i < len; i++) {
                        context.compiler.compile(children[i], context.scope);
                    }
                });
            },
            /** CSS类型命令 */
            css: function (context) {
                var target = context.target;
                // 记录原始class值
                var oriCls = target.getAttribute("class");
                // 生成订阅器
                context.entity.createWatcher(context.exp, context.scope, function (params) {
                    if (typeof params == "string") {
                        // 直接赋值形式
                        if (oriCls)
                            params = oriCls + " " + params;
                        // 更新target节点的class属性
                        target.setAttribute("class", params);
                    }
                    else {
                        // 集成形式
                        var arr = [];
                        if (oriCls)
                            arr.push(oriCls);
                        // 遍历所有params的key，如果其表达式值为true则添加其类型
                        for (var cls in params) {
                            if (params[cls] == true)
                                arr.push(cls);
                        }
                        // 更新target节点的class属性
                        if (arr.length > 0)
                            target.setAttribute("class", arr.join(" "));
                    }
                });
            },
            /** 修改任意属性命令 */
            attr: function (context) {
                var target = context.target;
                context.entity.createWatcher(context.exp, context.scope, function (value) {
                    if (context.subCmd != "") {
                        // 子命令形式
                        target.setAttribute(context.subCmd, value);
                    }
                    else {
                        // 集成形式，遍历所有value的key，如果其表达式值为true则添加其类型
                        for (var name in value) {
                            var value = value[name];
                            target.setAttribute(name, value);
                        }
                    }
                });
            },
            /** 绑定事件 */
            on: function (context) {
                if (context.subCmd != "") {
                    var handler = context.scope[context.exp] || window[context.exp];
                    if (typeof handler == "function") {
                        // 是函数名形式
                        context.target.addEventListener(context.subCmd, handler.bind(context.scope));
                    }
                    else {
                        // 是方法执行或者表达式方式
                        context.target.addEventListener(context.subCmd, function (evt) {
                            // 创建一个临时的子域，用于保存参数
                            var scope = Object.create(context.scope);
                            scope.$event = evt;
                            ares.utils.runExp(context.exp, scope);
                        });
                    }
                }
            },
            /** if命令 */
            if: function (context) {
                // 记录一个是否编译过的flag
                var compiled = false;
                // 插入一个占位元素
                var refNode = document.createTextNode("");
                context.target.parentNode.insertBefore(refNode, context.target);
                // 只有在条件为true时才启动编译
                context.entity.createWatcher(context.exp, context.scope, function (value) {
                    if (value == true) {
                        // 启动编译
                        if (!compiled) {
                            context.compiler.compile(context.target, context.scope);
                            compiled = true;
                        }
                        // 插入节点
                        if (!context.target.parentNode) {
                            refNode.parentNode.insertBefore(context.target, refNode);
                        }
                    }
                    else {
                        // 移除元素
                        if (context.target.parentNode) {
                            context.target.parentNode.removeChild(context.target);
                        }
                    }
                });
            },
            /** for命令 */
            for: function (context) {
                // 解析表达式
                var reg = /^\s*(\S+)\s+in\s+(\S+)\s*$/;
                var res = reg.exec(context.exp);
                if (!res) {
                    console.error("for命令表达式错误：" + context.exp);
                    return;
                }
                var itemName = res[1];
                var arrName = res[2];
                var pNode = context.target.parentNode;
                var sNode = document.createTextNode("");
                var eNode = document.createTextNode("");
                var range = document.createRange();
                // 替换原始模板
                pNode.replaceChild(eNode, context.target);
                pNode.insertBefore(sNode, eNode);
                // 添加订阅
                context.entity.createWatcher(arrName, context.scope, function (value) {
                    // 清理原始显示
                    range.setStart(sNode, 0);
                    range.setEnd(eNode, 0);
                    range.deleteContents();
                    // 如果是数字，构建一个数字列表
                    if (typeof value == "number") {
                        var temp = [];
                        for (var i = 0; i < value; i++) {
                            temp.push(i);
                        }
                        value = temp;
                    }
                    // 开始遍历
                    for (var key in value) {
                        // 拷贝一个target
                        var newNode = context.target.cloneNode(true);
                        // 添加到显示里
                        pNode.insertBefore(newNode, eNode);
                        // 生成子域
                        var newScope = Object.create(context.scope);
                        newScope.$index = key;
                        newScope[itemName] = value[key];
                        // 开始编译新节点
                        context.compiler.compile(pNode, newScope);
                    }
                });
            }
        };
    })(html = ares.html || (ares.html = {}));
})(ares || (ares = {}));
/// <reference path="../Interfaces.ts"/>
/// <reference path="../Utils.ts"/>
/// <reference path="HTMLCommands.ts"/>
/**
 * Created by Raykid on 2016/12/22.
 */
var ares;
(function (ares) {
    var html;
    (function (html) {
        var HTMLCompiler = (function () {
            function HTMLCompiler(idOrElement) {
                this._idOrElement = idOrElement;
            }
            HTMLCompiler.prototype.init = function (entity) {
                if (typeof this._idOrElement == "string")
                    this._root = document.getElementById(this._idOrElement) ||
                        document.getElementsByName(this._idOrElement)[0];
                else
                    this._root = this._idOrElement;
                this._entity = entity;
                // 开始编译root节点
                this.compile(this._root, entity.data);
            };
            HTMLCompiler.prototype.compile = function (node, scope) {
                if (node.nodeType == 3) {
                    // 是个文本节点
                    if (typeof this.compileTextContent != "function") {
                        alert("fuck");
                    }
                    this.compileTextContent(node, scope);
                }
                else {
                    // 不是文本节点
                    var hasLazyCompile = false;
                    // 首先解析当前节点上面以data-a-或者a-开头的属性，将其认为是绑定属性
                    var attrs = node.attributes;
                    var cmdsToCompile = [];
                    for (var i = 0, len = attrs.length; i < len; i++) {
                        var attr = attrs[i];
                        var name = attr.name;
                        // 所有属性必须以data-a-或者a-开头
                        if (name.indexOf("a-") == 0 || name.indexOf("data-a-") == 0) {
                            var bIndex = (name.charAt(0) == "d" ? 7 : 2);
                            var eIndex = name.indexOf(":");
                            if (eIndex < 0)
                                eIndex = name.length;
                            // 取到命令名
                            var cmdName = name.substring(bIndex, eIndex);
                            // 用命令名取到Command
                            var cmd = html.commands[cmdName];
                            if (cmd) {
                                // 取到子命令名
                                var subCmd = name.substr(eIndex + 1);
                                // 取到命令字符串
                                var exp = attr.value;
                                // 推入数组
                                cmdsToCompile.push({
                                    attr: attr,
                                    cmd: cmd,
                                    ctx: {
                                        scope: scope,
                                        target: node,
                                        subCmd: subCmd,
                                        exp: exp,
                                        compiler: this,
                                        entity: this._entity
                                    }
                                });
                                // 如果是for或者if则设置懒编译
                                if (cmdName == "if" || cmdName == "for") {
                                    hasLazyCompile = true;
                                    // 清空数组，仅留下自身的编译
                                    cmdsToCompile.splice(0, cmdsToCompile.length - 1);
                                    break;
                                }
                            }
                        }
                    }
                    // 开始编译当前节点外部结构
                    for (var i = 0, len = cmdsToCompile.length; i < len; i++) {
                        var cmdToCompile = cmdsToCompile[i];
                        // 移除属性
                        cmdToCompile.attr.ownerElement.removeAttribute(cmdToCompile.attr.name);
                        // 开始编译
                        cmdToCompile.cmd(cmdToCompile.ctx);
                    }
                    // 如果没有懒编译则编译内部结构
                    if (!hasLazyCompile) {
                        // 然后递归解析子节点
                        var children = node.childNodes;
                        for (var i = 0, len = children.length; i < len; i++) {
                            var child = children[i];
                            this.compile(child, scope);
                        }
                    }
                }
            };
            HTMLCompiler.prototype.compileTextContent = function (node, scope) {
                if (HTMLCompiler._textExpReg.test(node.nodeValue)) {
                    var exp = this.parseTextExp(node.nodeValue);
                    var cmd = ares.html.commands["textContent"];
                    cmd({
                        scope: scope,
                        target: node,
                        subCmd: "",
                        exp: exp,
                        compiler: this,
                        entity: this._entity
                    });
                }
            };
            HTMLCompiler.prototype.parseTextExp = function (exp) {
                var reg = HTMLCompiler._textExpReg;
                for (var result = reg.exec(exp); result != null; result = reg.exec(exp)) {
                    exp = "`" + result[1] + "${" + result[2] + "}" + result[3] + "`";
                }
                return exp;
            };
            HTMLCompiler._textExpReg = /(.*?)\{\{(.*?)\}\}(.*)/;
            return HTMLCompiler;
        })();
        html.HTMLCompiler = HTMLCompiler;
    })(html = ares.html || (ares.html = {}));
})(ares || (ares = {}));
/// <reference path="../src/ares/Ares.ts"/>
/// <reference path="../src/ares/html/HTMLCompiler.ts"/>
/**
 * Created by Raykid on 2016/12/23.
 */
ares.bind({
    text: "text",
    test: {
        text: "test.text"
    },
    testHTML: "<div>fff</div>",
    testCls: "test1",
    testIf: false,
    testIfText: "if Text",
    testArr: [1, 2, 3, 4],
    testFunc: function (evt) {
        var data = this;
        data.text = 'aaaa';
        data.test.text = "asdfasdf";
        data.testHTML = "<h1 a-text='test.text' a-on:click='alert(\"fuck\");'></h1>";
        data.testCls = "test2";
        data.testIfText = "if Text2";
        data.testIf = true;
        data.testIfText = "if Text3";
        data.testArr = ["fuck", "you", "!!!"];
        setTimeout(function () {
            data.testArr.push("TWICE !!!");
        }, 2000);
        setTimeout(function () {
            data.testArr.splice(3, 1, "THIRD TIMES!!!");
        }, 4000);
        setTimeout(function () {
            data.testArr.$set(0, "love");
        }, 6000);
    }
}, new ares.html.HTMLCompiler("div_root"), {
    inited: function () {
    }
});
//# sourceMappingURL=test2.js.map