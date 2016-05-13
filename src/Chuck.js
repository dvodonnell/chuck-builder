var chokidar = require('chokidar'),
    sass = require('node-sass'),
    fs = require('fs');

var path = require('path');

var Chuck = {

    build : function(config, distKey) {

        var dets = this._processFile(config.entry, config.map, distKey, [config.entry], {}, config.exportAs || 'App', config.verbose || false);

        var contents = 'var _G = {};';

        var addedModules = [];

        for (var i = 0; i < dets.modules.length; i++) {
            if (addedModules.indexOf(dets.modules[i]) < 0) {
                contents += dets.moduleContents[dets.modules[i]] + "\n";
                addedModules.push(dets.modules[i]);
            }
        }

        contents += "var " + (config.exportAs || 'App') + " = _G['" + (config.exportAs || 'App') + "']";

        fs.writeFileSync(config.out, contents, 'utf8');

    },

    _move : function(arr, old_index, new_index) {

        if (new_index >= arr.length) {
            var k = new_index - arr.length;
            while ((k--) + 1) {
                arr.push(undefined);
            }
        }
        arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
        return arr; // for testing purposes

    },

    _processFile : function(fpath, map, distKey, modules, moduleContents, moduleKeyName, verbose) {

        var modules = modules || [],
            moduleContents = moduleContents || {};

        var contents = fs.readFileSync(fpath, 'utf8'),
            compiledLines = [],
            depNS = [],
            depVars = [];

        var lines = contents.split(';');

        //var importCnt = 0;

        for (var i = 0; i < lines.length; i++) {

            var cmds = lines[i].trim().split(/\s+/);

            if (cmds[0] === 'import') {

                var ns = eval(cmds[3]);

                var resPath = null;

                if (ns.charAt(0) === '.') {

                    //path-based import

                    var currPath = path.dirname(fpath);

                    try {
                        fs.statSync(currPath + '/' + ns);
                        resPath = currPath + '/' + ns;
                    } catch (e) {
                        console.log('Resource specified by relative path to ' + currPath + '/' + ns + ' not found.');
                    }

                } else {

                    //namespace-based import

                    try {
                        resPath = eval('map.'+distKey+'.'+ns);
                    } catch (e) {
                        try {
                            resPath = eval('map.common.'+ns);
                        } catch (e) {
                            console.log(ns + ' is not set in the resource map for dist '+distKey+'.');
                        }
                    }

                }

                if (resPath) {

                    var compile = true,
                        mappingVar = null;

                    if (typeof resPath === 'object') {

                        if (resPath.pristine) {
                            compile = false;
                        }

                        if (resPath.mappingVar) {
                            mappingVar = resPath.mappingVar;
                        }

                        resPath = resPath.path;

                    }

                    depVars.push(cmds[1]);
                    depNS.push(ns);

                    //if (modules.indexOf(resPath) > -1) {
                        /*modules = Chuck._move(modules, modules.indexOf(resPath), importCnt);
                        if (verbose) {
                            console.log('Moving ' + resPath + ' to ' + importCnt);
                        }*/
                    //} else {
                        /*if (modules.indexOf(resPath) > -1) {
                            modules = Chuck._move(modules, modules.indexOf(resPath), importCnt);
                        } else {
                            modules.splice(importCnt, 0, resPath);
                            importCnt++;
                        }*/

                        modules.unshift(resPath);

                        if (verbose) {
                            //console.log('Adding ' + resPath + ' to ' + importCnt, modules.length);
                        }
                        //modules.unshift(resPath);
                        if (compile) {
                            var innerProc = Chuck._processFile(resPath, map, distKey, modules, moduleContents, ns, verbose);
                            //importCnt = importCnt + innerProc.importCnt;
                            modules = innerProc.modules;
                            moduleContents = innerProc.moduleContents;
                        } else {

                            var rawContents = fs.readFileSync(resPath, 'utf8');

                            if (mappingVar) {
                                rawContents += "_G['" + ns + "'] = " + mappingVar + ";";
                            }

                            moduleContents[resPath] = rawContents;

                        }
                    //}


                }

            } else if (cmds[0] === 'export') {

                if (moduleKeyName) {
                    compiledLines.push(lines[i].replace("export default", "_G['"+moduleKeyName+"'] ="));
                }

            } else {
                compiledLines.push(lines[i]);
            }

        }

        moduleContents[fpath] = '(function('+depVars.join(',')+'){' + compiledLines.join(";\n") + '})('+ ((depNS.length) ? '_G["'+depNS.join('"],_G["') + '"]' : '') +');';

        console.log(modules, '---');

        return {modules : modules, moduleContents : moduleContents};

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