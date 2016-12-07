/**
 * Created by Raykid on 2016/12/6.
 */
var core;
(function (core) {
    var Expresion = (function () {
        function Expresion(exp) {
            this._exp = this.changeParamNames(exp);
        }
        Expresion.prototype.getFirst = function (exp, flag, from) {
            if (from === void 0) { from = 0; }
            var reg = new RegExp("(\\\\*)" + flag, "g");
            reg.lastIndex = from;
            for (var res = reg.exec(exp); res != null; res = reg.exec(exp)) {
                // 如果字符前面的\是奇数个，表示这个字符是被转义的，不是目标字符
                if (res[1].length % 2 == 0) {
                    return {
                        begin: res.index,
                        end: res.index + res[0].length,
                        value: res[0]
                    };
                }
            }
            return null;
        };
        /**
         * 获取flag表示的字符之间所有的字符，该字符前面如果有\则会当做普通字符，而不会作为flag字符
         * @param exp 原始表达式
         * @param begin 边界开始字符串
         * @param end 边界结束字符串
         * @returns {ContentResult} 内容结构体
         */
        Expresion.prototype.getContentBetween = function (exp, begin, end) {
            var bRes = this.getFirst(exp, begin);
            if (!bRes)
                return null;
            var eRes = this.getFirst(exp, end, bRes.end);
            if (!eRes)
                return null;
            return {
                begin: bRes.end,
                end: eRes.begin,
                value: exp.substring(bRes.end, eRes.begin)
            };
        };
        Expresion.prototype.parseOriExp = function (exp) {
            if (exp == "")
                return exp;
            // 分别将""和''找出来，然后将其两边的字符串递归处理，最后再用正则表达式匹配
            var first1 = this.getFirst(exp, "'");
            var first2 = this.getFirst(exp, '"');
            var first, second;
            if (first1 && first2) {
                // 单双引号都有，取第一个出现的符号
                if (first1.begin < first2.begin) {
                    // 单引号
                    first = first1;
                    second = this.getFirst(exp, first.value, first.end);
                    exp = this.parseOriExp(exp.substr(0, first.begin)) + exp.substring(first.begin, second.end) + this.parseOriExp(exp.substr(second.end));
                }
                else {
                    // 双引号
                    first = first2;
                    second = this.getFirst(exp, first.value, first.end);
                    exp = this.parseOriExp(exp.substr(0, first.begin)) + exp.substring(first.begin, second.end) + this.parseOriExp(exp.substr(second.end));
                }
            }
            else if (first1) {
                // 只有单引号
                first = first1;
                second = this.getFirst(exp, first.value, first.end);
                exp = this.parseOriExp(exp.substr(0, first.begin)) + exp.substring(first.begin, second.end) + this.parseOriExp(exp.substr(second.end));
            }
            else if (first2) {
                // 只有双引号
                first = first2;
                second = this.getFirst(exp, first.value, first.end);
                exp = this.parseOriExp(exp.substr(0, first.begin)) + exp.substring(first.begin, second.end) + this.parseOriExp(exp.substr(second.end));
            }
            else {
                // 啥都没有，使用正则表达式匹配
                exp = exp.replace(/[\w\.\$]+/g, function (str) {
                    if (str.indexOf("$data.") != 0) {
                        str = "$data." + str;
                    }
                    return str;
                });
            }
            return exp;
        };
        Expresion.prototype.parseTempExp = function (exp) {
            if (exp == "")
                return exp;
            var res = this.getContentBetween(exp, "\\$\\{", "\\}");
            if (res) {
                var temp = res.value;
                if (temp.indexOf("$data.") != 0)
                    temp = "$data." + temp;
                exp = exp.substr(0, res.begin) + temp + "}" + this.parseTempExp(exp.substr(res.end + 1));
            }
            return exp;
        };
        Expresion.prototype.run = function (scope) {
            return new Function("$data", "return " + this._exp)(scope);
        };
        /**
         * 将表达式中所有不以$data.开头的变量都加上$data.，以防找不到变量
         * @param exp 字符串表达式
         * @returns {string} 处理后的表达式
         */
        Expresion.prototype.changeParamNames = function (exp) {
            if (exp == null || exp == "")
                return exp;
            // 用普通字符串方式处理模板字符串前面的部分，用模板字符串方式处理模板字符串部分，然后递归处理剩余部分
            var res = this.getContentBetween(exp, "`", "`");
            if (res)
                exp = this.parseOriExp(exp.substr(0, res.begin - 1)) + "`" + this.parseTempExp(res.value) + "`" + this.changeParamNames(exp.substr(res.end + 1));
            else
                exp = this.parseOriExp(exp);
            return exp;
        };
        return Expresion;
    })();
    core.Expresion = Expresion;
})(core || (core = {}));
/**
 * Created by Raykid on 2016/12/6.
 */
var core;
(function (core) {
    /** 文本命令 */
    var TextCmd = (function () {
        function TextCmd() {
        }
        TextCmd.prototype.exec = function (target, exp, scope) {
            var expresion = new core.Expresion(exp);
            return {
                update: function () {
                    // 更新target节点的innerText
                    target.innerText = expresion.run(scope);
                }
            };
        };
        return TextCmd;
    })();
    core.TextCmd = TextCmd;
    /** HTML文本命令 */
    var HtmlCmd = (function () {
        function HtmlCmd() {
        }
        HtmlCmd.prototype.exec = function (target, exp, scope) {
            var expresion = new core.Expresion(exp);
            return {
                update: function () {
                    // 更新target节点的innerHTML
                    target.innerHTML = expresion.run(scope);
                }
            };
        };
        return HtmlCmd;
    })();
    core.HtmlCmd = HtmlCmd;
    /** if命令 */
    var IfCmd = (function () {
        function IfCmd() {
        }
        IfCmd.prototype.exec = function (target, exp, scope) {
            var expresion = new core.Expresion(exp);
            return {
                update: function () {
                    var condition = expresion.run(scope);
                    target.style.display = (condition ? "" : "none");
                }
            };
        };
        return IfCmd;
    })();
    core.IfCmd = IfCmd;
    /** for命令 */
    var ForCmd = (function () {
        function ForCmd() {
            this._reg = /([\w\.\$]+)\s+in\s+([\w\.\$]+)/;
        }
        Object.defineProperty(ForCmd.prototype, "priority", {
            get: function () {
                return 1000;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ForCmd.prototype, "stopCompile", {
            get: function () {
                // for命令需要将所有子节点延迟到更新时再编译
                return true;
            },
            enumerable: true,
            configurable: true
        });
        ForCmd.prototype.exec = function (target, exp, scope) {
            var _this = this;
            var targets = [];
            var res = this._reg.exec(exp);
            var subName = res[1];
            var listName = res[2];
            return {
                update: function (entity) {
                    // 首先清空当前已有的对象节点
                    var len = targets.length;
                    while (len--) {
                        var child = targets.pop();
                        child.parentElement.removeChild(child);
                    }
                    // 生成新对象
                    var parent = target.parentElement;
                    var list = new core.Expresion(listName).run(scope);
                    var subScope = {};
                    subScope.__proto__ = scope;
                    for (var i = 0, len = list.length; i < len; i++) {
                        // 构造一个新作用域
                        subScope[subName] = list[i];
                        // 构造一个新的节点，如果是第一个元素则直接使用target作为目标节点
                        var newTarget = target.cloneNode(true);
                        parent.appendChild(newTarget);
                        targets.push(newTarget);
                        // 用新的作用域遍历新节点
                        var updaters = entity.compile(newTarget, subScope);
                        // 立即更新
                        updaters.map(function (updater) { return updater.update(entity); }, _this);
                    }
                }
            };
        };
        return ForCmd;
    })();
    core.ForCmd = ForCmd;
})(core || (core = {}));
/// <reference path="Expresion.ts"/>
/// <reference path="SystemCmd.ts"/>
/**
 * Created by Raykid on 2016/12/6.
 */
var core;
(function (core) {
    var Command = (function () {
        function Command() {
        }
        /** 获取命令对象 */
        Command.getCmd = function (name) {
            // 优先查找系统命令，找不到再去自定义命令表查找
            return (Command._depMap[name] ||
                Command._customCmdMap[name]);
        };
        /**
         * 添加命令对象
         * @param name 命令对象名字
         * @param dep 命令对象实现对象
         */
        Command.addCmd = function (name, dep) {
            Command._customCmdMap[name] = dep;
        };
        /**
         * 移除命令对象
         * @param name 命令对象名字
         * @returns {Cmd} 被移除的命令对象
         */
        Command.removeCmd = function (name) {
            var dep = Command._customCmdMap[name];
            delete Command._customCmdMap[name];
            return dep;
        };
        // 自定义的命令表
        Command._customCmdMap = {};
        // 系统默认的命令表
        Command._depMap = {
            text: new core.TextCmd(),
            html: new core.HtmlCmd(),
            if: new core.IfCmd(),
            for: new core.ForCmd()
        };
        return Command;
    })();
    core.Command = Command;
})(core || (core = {}));
/// <reference path="Command.ts"/>
/**
 * Created by Raykid on 2016/12/5.
 */
var core;
(function (core) {
    var AresEntity = (function () {
        function AresEntity(data, element) {
            this._element = element;
            this._data = data;
            // 生成一个data的浅层拷贝对象，作为data原始值的保存
            this.proxyData(data, []);
            // 向data中加入$data、$parent和$root参数，都是data本身，用以构建一个Scope对象
            data.$data = data.$parent = data.$root = data;
            // 开始解析整个element，用整个data作为当前词法作用域
            this._updaters = this.compile(element, data);
            // 进行一次全局更新
            this.update();
        }
        /**
         * 为对象安插代理，会篡改对象中的实例为getter和setter，并且返回原始对象的副本
         * @param data 要篡改的对象
         * @param path 当前路径数组
         */
        AresEntity.prototype.proxyData = function (data, path) {
            var original = {};
            // 记录当前层次所有的属性，如果有复杂类型对象则递归之
            var keys = Object.keys(data);
            for (var i = 0, len = keys.length; i < len; i++) {
                var key = keys[i];
                var value = data[key];
                switch (typeof value) {
                    case "object":
                        if (value instanceof Array) {
                            // 是数组，对于其自身要和简单类型一样处理
                            original[key] = value;
                            Object.defineProperty(data, key, {
                                configurable: true,
                                enumerable: true,
                                get: this.getProxy.bind(this, original, key),
                                set: this.setProxy.bind(this, original, key)
                            });
                            // 篡改数组的特定方法
                            var self = this;
                            AresEntity._arrayMethods.map(function (method) {
                                value[method] = function () {
                                    // 调用原始方法
                                    Array.prototype[method].apply(this, arguments);
                                    // 更新
                                    self.update();
                                };
                            }, this);
                        }
                        else {
                            // 复杂类型，需要递归
                            var temp = path.concat();
                            temp.push(key);
                            original[key] = this.proxyData(value, temp);
                        }
                        break;
                    case "function":
                        // 是方法，直接记录之
                        original[key] = value;
                        break;
                    default:
                        // 简单类型，记录一个默认值
                        original[key] = value;
                        // 篡改为getter和setter
                        Object.defineProperty(data, key, {
                            configurable: true,
                            enumerable: true,
                            get: this.getProxy.bind(this, original, key),
                            set: this.setProxy.bind(this, original, key)
                        });
                        break;
                }
            }
            data.$original = original;
        };
        AresEntity.prototype.getProxy = function (original, key) {
            return original[key];
        };
        AresEntity.prototype.setProxy = function (original, key, value) {
            original[key] = value;
            this.update();
        };
        AresEntity.prototype.update = function () {
            // TODO Raykid 现在是全局更新，要改为条件更新
            for (var i = 0, len = this._updaters.length; i < len; i++) {
                this._updaters[i].update(this);
            }
        };
        AresEntity.prototype.compile = function (element, scope) {
            // 检查节点上面以data-a-或者a-开头的属性，将其认为是绑定属性
            var attrs = element.attributes;
            var bundles = [];
            var stopCompile = false;
            for (var i = 0, len = attrs.length; i < len; i++) {
                var attr = attrs[i];
                var name = attr.name;
                // 所有ares属性必须以data-a-或者a-开头
                if (name.indexOf("a-") == 0 || name.indexOf("data-a-") == 0) {
                    var index = (name.charAt(0) == "d" ? 7 : 2);
                    // 取到命令名
                    var cmdName = name.substr(index);
                    // 用命令名取到命令依赖对象
                    var cmd = core.Command.getCmd(cmdName);
                    if (cmd) {
                        bundles.push({ cmd: cmd, attr: attr });
                        // 更新编译子节点的属性
                        if (cmd.stopCompile) {
                            stopCompile = true;
                            // 只剩下这一个命令
                            bundles.splice(0, bundles.length - 1);
                            break;
                        }
                    }
                }
            }
            // 排序cmd
            bundles.sort(function (a, b) { return (b.cmd.priority || 0) - (a.cmd.priority || 0); });
            // 开始执行cmd
            var updaters = [];
            for (var i = 0, len = bundles.length; i < len; i++) {
                var bundle = bundles[i];
                // 生成一个更新项
                var updater = bundle.cmd.exec(element, bundle.attr.value, scope);
                // TODO Raykid 现在是全局更新，要改为条件更新
                updaters.push(updater);
                // 从DOM节点上移除属性
                bundle.attr.ownerElement.removeAttributeNode(attr);
            }
            // 遍历子节点
            if (!stopCompile) {
                var children = element.children;
                for (var i = 0, len = children.length; i < len; i++) {
                    var child = children[i];
                    var temp = this.compile(child, scope);
                    updaters = updaters.concat(temp);
                }
            }
            // 返回Updater
            return updaters;
        };
        AresEntity._arrayMethods = [
            'push',
            'pop',
            'shift',
            'unshift',
            'splice',
            'sort',
            'reverse'
        ];
        return AresEntity;
    })();
    core.AresEntity = AresEntity;
})(core || (core = {}));
/// <reference path="core/AresEntity.ts"/>
/**
 * Created by Raykid on 2016/12/5.
 */
var Ares = (function () {
    function Ares() {
    }
    /**
     * 创建一个数据绑定
     * @param viewModel 要绑定的数据对象
     * @param nameOrElement 要绑定到的DOM节点的名字或者引用
     * @param options 额外参数，参考AresOptions接口
     */
    Ares.create = function (viewModel, nameOrElement, options) {
        if (document.body) {
            doCreate();
        }
        else {
            window.onload = doCreate;
        }
        function doCreate() {
            var el;
            if (typeof nameOrElement == "string") {
                el = document.getElementById(nameOrElement);
            }
            else {
                el = nameOrElement;
            }
            // 生成一个Entity
            new core.AresEntity(viewModel, el);
            // 调用回调
            if (options && options.initialized)
                options.initialized(viewModel);
        }
    };
    return Ares;
})();
//# sourceMappingURL=ares.js.map