var chokidar = require('chokidar'),
    sass = require('node-sass'),
    fs = require('fs');

var Chuck = {

    build : function(config, distKey) {

        var jsOut = '';

        if (config.sources) {
            jsOut = Chuck._concatinate(config.sources, distKey);
        }

        jsOut = '(function(root,factory){ if (typeof module === "object" && module.exports) { module.exports = factory(); } else { root["'+config.products.jsObj+'"] = factory(); } })(this,function(){' + jsOut + ' return g.use("'+config.products.jsEndpoint+'"); });';

        fs.writeFile(config.paths.js + '/' + config.products.js, jsOut);

        if (config.scss) {
            Chuck._sass(config.scss, config.paths.css + '/' + config.products.css);
        }

    },

    watch : function(paths, cb) {

        chokidar.watch(paths, {usePolling:true, ignoreInitial:true}).on('all', function(event, path) {
            cb();
        });

    },

    _concatinate : function(files, distKey) {

        //TODO generalize this to various platforms

        var buffer = "var G = function(){this._libs={}}; G.prototype={add:function(key,obj){this._libs[key]=obj;}, use:function(key){return this._libs[key];}};\n";
        buffer += "var g = new G();";

        for (var i=0; i<files.length; i++) {

            var contents = '';

            if (files[i].path) {
                contents = fs.readFileSync(files[i].path, 'utf8');
            } else if (files[i].src) {
                contents = files[i].src;
            }

            var includeFile = ((!files[i].excludeFor || files[i].excludeFor.indexOf(distKey) === -1) && (!files[i].includeFor || files[i].includeFor.indexOf(distKey) > -1));

            if (includeFile) {

                if (!files[i].preserve) {

                    contents = contents.replace("export default", "return");

                    var preStr = "g.add('"+files[i].name+"', (function(__dep){",
                        appStr = "})(g));\n";

                    /*var innerVars = [],
                        innerRefs = [];

                    if (files[i].deps) {
                        for (varName in files[i].deps) {
                            innerVars.push(varName);
                            innerRefs.push("G['" + files[i].deps[varName] + "']");
                        }
                    }

                    preStr += innerVars.join(',');
                    appStr += innerRefs.join(',');

                    preStr += '){';
                    appStr += ");\n";*/

                    buffer += preStr + contents + appStr;

                } else {

                    if (files[i].setFromGlobal && files[i].name) {

                        buffer += contents + "\n" + 'g.add("'+files[i].name+'", ' + files[i].setFromGlobal + ");";

                    } else {

                        buffer += contents;

                    }

                }

            }

        }

        return buffer;

    },

    _sass : function(scssFile, outputFile) {

        sass.render({
            file : scssFile
        }, function(err, result) {

            if (err) {
                console.log(err);
            } else {
                fs.writeFileSync(outputFile, result.css);
            }

        });

    }

};

module.exports = Chuck;