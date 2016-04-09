var chokidar = require('chokidar'),
    sass = require('node-sass'),
    buildify = require('buildify'),
    fs = require('fs');

var Chuck = {

    build : function(config) {

        if (config.sources) {
            Chuck._concatinate(config.sources, config.paths.js + '/' + config.products.js);
        }

        if (config.scss) {
            Chuck._sass(config.scss, config.paths.css + '/' + config.products.css);
        }

    },

    watch : function(paths, cb) {

        chokidar.watch(paths, {usePolling:true, ignoreInitial:true}).on('all', function(event, path) {
            cb();
        });

    },

    _concatinate : function(files, outputFile) {

        buildify().concat(files).save(outputFile);

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