/**
 * Created by Raykid on 2016/12/5.
 */
Ares.create({
    test: "测试数据",
    testVisible: false,
    testRecursion: {
        fuck: 1,
        testRecFunc: function(y){return y+y;}
    },
    testFunction: function(x){return x*x;}
}, "div_root", {
    initialized: function(vm)
    {
        vm.testRecursion.fuck = "fuck you!!!";

        setTimeout(function(){
            vm.testVisible = true;
        }, 1000);

        setTimeout(function(){
            vm.test = "fuck！！！！！！！";
        }, 3000);
    }
});