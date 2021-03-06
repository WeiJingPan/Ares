/// <reference path="../dist/ares.d.ts"/>
/// <reference path="ares_html.d.ts"/>
/// <reference path="ares_pixi.d.ts"/>
/// <reference path="pixi.js.d.ts"/>

/**
 * Created by Raykid on 2016/12/23.
 */
window.onload = ()=>
{
    var renderer:PIXI.SystemRenderer = PIXI.autoDetectRenderer(800, 600, {backgroundColor:0xeeeeee});
    document.getElementById("div_root").appendChild(renderer.view);
    var stage:PIXI.Container = new PIXI.Container();
    render();

    function render():void
    {
        try
        {
            // 渲染Stage
            renderer.render(stage);
        }
        catch(err)
        {
            console.error(err.toString());
        }
        // 计划下一次渲染
        requestAnimationFrame(render);
    }

    var testSkin:PIXI.Container = new PIXI.Container();
    stage.addChild(testSkin);

    var testSprite:PIXI.Sprite = new PIXI.Sprite();
    testSprite.texture = PIXI.Texture.fromImage("http://pic.qiantucdn.com/58pic/14/45/39/57i58PICI2K_1024.png");
    testSprite.width = testSprite.height = 200;
    testSprite.interactive = true;
    testSprite["a-on:click"] = "testFunc";
    testSprite["a-for"] = "item in testFor";
    testSprite["a-x"] = "$target.x + $index * 200";
    testSprite.x = 200;
    testSkin.addChild(testSprite);

    var testText:PIXI.Text = new PIXI.Text("text: {{text}}, {{item}}");
    testText["a_for"] = "item in testFor";
    testText["a-y"] = "$target.y + $index * 100";
    testText.y = 300;
    testSkin.addChild(testText);

    var data:any = {
        text: "text",
        testFor: [],
        testFunc: function(evt:Event):void
        {
            this.text = "Fuck!!!";
        }
    };

    ares.bind(data, new ares.pixijs.PIXICompiler(testSkin));

    ares.bind(data, new ares.html.HTMLCompiler("#div_root"));

    setTimeout(()=>{
        data.testFor = ["asdf", "ajsdf", 323];
    }, 2000);
};