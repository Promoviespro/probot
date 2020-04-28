const fs = require('fs')
const glob = require('glob')
const path = require('path')
const pkg = require('./package.json')
const notifySend = require('node-notifier')
const argv = require('yargs').argv
const projectRoot = __dirname.replace(/\\/g, '/')
const hasOwn = Object.prototype.hasOwnProperty
const MINIMUM_TRANSLATED = 50
const LANG_ID_SOURCE = 'en_us'
const overflow = generateOverflowModule()

function init () {
    fs.mkdirSync(`${projectRoot}/dist`, {
        recursive: true
    })

    lintCode()
        .then(concatCode)
        .then(compileLess)
        .then(minifyHTML)
        .then(generateLanguageFile)
        .then(replaceInFile)
        .then(minifyCode)
        .then(function () {
            console.log('Build finished')

            fs.rmdirSync(`${projectRoot}/tmp`, {
                recursive: true
            })

            notifySend.notify({
                title: 'TWOverflow',
                message: 'Build complete',
                timeout: 1000
            })
        })
        .catch(function (error) {
            console.log('Build failed')

            fs.rmdirSync(`${projectRoot}/tmp`, {
                recursive: true
            })

            if (typeof error !== 'undefined') {
                console.log(error)
            }

            notifySend.notify({
                title: 'TWOverflow',
                message: 'Build failed',
                timeout: 2000
            })
        })
}

function lintCode () {
    return new Promise(function (resolve, reject) {
        if (!argv.lint) {
            return resolve()
        }

        console.log('Running lint')

        const LINT_SEVERITY_CODES = { 1: 'WARN', 2: 'ERROR' }
        const CLIEngine = require('eslint').CLIEngine
        const cli = new CLIEngine()
        let lint = cli.executeOnFiles(`${projectRoot}/src`)
        let clean = !(lint.warningCount + lint.errorCount)

        if (!clean) {
            console.log(`Warnings: ${lint.warningCount}  Errors: ${lint.errorCount}`)
            console.log('')
        }

        lint.results.forEach(function (fileLint) {
            if (fileLint.messages.length) {
                console.log(fileLint.filePath)

                fileLint.messages.forEach(function (error) {
                    let severityLabel = LINT_SEVERITY_CODES[error.severity]

                    console.log(`${error.line}:${error.column}  ${severityLabel}  ${error.message}`)
                })

                console.log('')
            }
        })

        if (clean) {
            console.log('OK')
            console.log('')
            resolve()
        } else {
            reject()
        }
    })
}

function concatCode () {
    return new Promise(function (resolve) {
        console.log('Concatenating scripts')

        const code = overflow.js.map(function (file) {
            return fs.readFileSync(`${projectRoot}/${file}`, 'utf8')
        })

        fs.writeFileSync(`${projectRoot}/dist/tw2overflow.js`, code.join('\n'), 'utf8')

        console.log('OK')
        console.log('')
        resolve()
    })
}

function compileLess () {
    return new Promise(function (resolve, reject) {
        console.log('Compiling styles')

        let lessPromises = []

        for (let destination in overflow.css) {
            const sourceLocation = overflow.css[destination]
            const source = fs.readFileSync(`${projectRoot}${sourceLocation}`, 'utf8')
            const fileName = path.basename(destination)
            const destinationDir = projectRoot + path.dirname(destination)

            fs.mkdirSync(destinationDir, {
                recursive: true
            })

            let promise = require('less').render(source, {
                compress: true
            }).then(function (output) {
                fs.writeFileSync(`${destinationDir}/${fileName}`, output.css, 'utf8')
            })

            lessPromises.push(promise)
        }

        Promise.all(lessPromises).then(function () {
            console.log('OK')
            console.log('')
            resolve()
        }).catch(function (error) {
            reject(error)
        })
    })
}

function minifyHTML () {
    return new Promise(function (resolve) {
        console.log('Minifying templates')

        for (let destination in overflow.html) {
            const sourceLocation = overflow.html[destination]
            const source = fs.readFileSync(`${projectRoot}${sourceLocation}`, 'utf8')

            let output = require('html-minifier').minify(source, {
                removeRedundantAttributes: true,
                removeOptionalTags: true,
                collapseWhitespace: true,
                removeComments: true,
                removeTagWhitespace: false,
                quoteCharacter: '"'
            })

            // workaround! waiting https://github.com/terser/terser/issues/518
            output = output.replace(/"/g, '\\"')

            fs.writeFileSync(`${projectRoot}${destination}`, output, 'utf8')
        }

        console.log('OK')
        console.log('')
        resolve()
    })
}

function generateLanguageFile () {
    return new Promise(function (resolve, reject) {
        const modules = fs.readdirSync(`${projectRoot}/src/i18n/`, {
            withFileTypes: true
        }).filter(function (dirent) {
            return dirent.isDirectory()
        }).map(function (moduleDir) {
            return moduleDir.name
        })

        const mergedTranslations = {}

        for (let a = 0; a < modules.length; a++) {
            const moduleId = modules[a]
            const sourceTranslations = JSON.parse(fs.readFileSync(`${projectRoot}/src/i18n/${moduleId}.json`, 'utf8'))
            const sourceTotalEntries = getTranslationEntries(sourceTranslations)
            const moduleTranslations = fs.readdirSync(`${projectRoot}/src/i18n/${moduleId}`)

            mergedTranslations[LANG_ID_SOURCE] = {
                ...mergedTranslations[LANG_ID_SOURCE],
                ...sourceTranslations
            }

            for (let b = 0; b < moduleTranslations.length; b++) {
                const translationFile = moduleTranslations[b]
                const translationId = translationFile.replace('.json', '')
                const translation = JSON.parse(fs.readFileSync(`${projectRoot}/src/i18n/${moduleId}/${translationFile}`, 'utf8'))
                const translationStatus = getTranslationStatus(moduleId, translationId, sourceTranslations, translation)

                if (!translationStatus.valid) {
                    return reject(translationStatus.msg)
                }

                const translationTotalEntries = getTranslationEntries(translation)
                const percentageTranslated = Math.floor(translationTotalEntries / sourceTotalEntries * 100)

                if (percentageTranslated >= MINIMUM_TRANSLATED) {
                    mergedTranslations[translationId] = mergedTranslations[translationId] || {}
                    mergedTranslations[translationId] = {
                        ...mergedTranslations[translationId],
                        ...mergeSouceIntoTranslation(sourceTranslations, translation)
                    }
                }
            }
        }

        fs.writeFileSync(`${projectRoot}/tmp/i18n.json`, JSON.stringify(mergedTranslations, null, 4), 'utf8')

        resolve()
    })
}

function replaceInFile () {
    return new Promise(function (resolve) {
        console.log('Replacing values')

        const delimiters = ['___', '']
        let target = fs.readFileSync(`${projectRoot}/dist/tw2overflow.js`, 'utf8')
        let search
        let replace
        let ordered = {
            file: {},
            text: {}
        }

        for (search in overflow.replaces) {
            replace = overflow.replaces[search]

            if (replace.slice(0, 11) === '~read-file:') {
                ordered.file[search] = fs.readFileSync(projectRoot + replace.slice(11), 'utf8')
            } else {
                ordered.text[search] = replace
            }
        }

        for (search in ordered.file) {
            replace = ordered.file[search]
            search = `${delimiters[0]}${search}${delimiters[1]}`

            target = replaceText(target, search, replace)
        }

        for (search in ordered.text) {
            replace = ordered.text[search]
            search = `${delimiters[0]}${search}${delimiters[1]}`

            target = replaceText(target, search, replace)
        }

        fs.writeFileSync(`${projectRoot}/dist/tw2overflow.js`, target, 'utf8')

        console.log('OK')
        console.log('')
        resolve()
    })
}

function minifyCode () {
    return new Promise(function (resolve, reject) {
        if (!argv.minify) {
            return resolve()
        }

        console.log('Compressing script')

        const minified = require('terser').minify({
            'tw2overflow.js': fs.readFileSync(`${projectRoot}/dist/tw2overflow.js`, 'utf8')
        }, {
            output: {
                quote_style: 3, // note: it's not working
                max_line_len: 1000
            }
        })
        
        if (minified.error) {
            const error = minified.error

            console.log('')
            console.log(error.filename)
            console.log(`${error.line}:${error.col}  ${error.name}  ${error.message}`)
            console.log('')

            return reject()
        }

        fs.writeFileSync(`${projectRoot}/dist/tw2overflow.min.js`, minified.code, 'utf8')

        console.log('OK')
        console.log('')
        resolve()
    })
}

function getTranslationEntries (translation) {
    let entries = 0

    for (let category in translation) {
        for (let key in translation[category]) {
            if (translation[category][key]) {
                entries++
            }
        }
    }

    return entries
}

function mergeSouceIntoTranslation (source, translation) {
    let merged = {}

    for (let category in source) {
        merged[category] = {}

        for (let key in source[category]) {
            if (translation[category][key]) {
                merged[category][key] = translation[category][key]
            } else {
                merged[category][key] = source[category][key]
            }
        }
    }

    return merged
}

function getTranslationStatus (moduleId, translationId, source, translation) {
    let status = {
        valid: true,
        msg: 'Valid translation'
    }

    for (let category in source) {
        if (!hasOwn.call(translation, category)) {
            status.valid = false
            status.msg = `Translation "${translationId}" from module "${moduleId}" missing category: ${category}`
        }

        for (let key in source[category]) {
            if (!hasOwn.call(translation[category], key)) {
                status.valid = false
                status.msg = `Translation "${translationId}" from module "${moduleId}" missing key: ${category}:${key}`
            }
        }
    }

    return status
}

/**
 * generateModule will generate a object with all information/sources from
 * the the module.
 *
 * Module required files
 * - /module.json
 * - /src/core.js
 * - /src/init.js
 *
 * Module optional folders/files
 * - /src/*.js
 * - /assets/*.html
 * - /assets/*.less
 * - /lang/*.json
 */
function generateModule (moduleId, moduleDir) {
    const modulePath = `/src/modules/${moduleDir}`
    let data = {
        id: moduleId,
        dir: moduleDir,
        js: [],
        css: [],
        html: [],
        replaces: {},
        lang: false
    }

    // Load module info file
    if (fs.existsSync(`${projectRoot}${modulePath}/module.json`)) {
        const modulePackage = JSON.parse(fs.readFileSync(`${projectRoot}${modulePath}/module.json`, 'utf8'))

        for (let key in modulePackage) {
            data.replaces[`${moduleId}_${key}`] = modulePackage[key]
        }
    } else {
        return console.error(`Module "${moduleId}" is missing "module.json"`)
    }

    // Load the main js source
    if (fs.existsSync(`${projectRoot}${modulePath}/src/core.js`)) {
        data.js.push(`${modulePath}/src/core.js`)
    } else {
        return console.error(`Module "${moduleId}" is missing "core.js"`)
    }

    // Load all complementaty js sources
    const source = glob.sync(`${projectRoot}${modulePath}/src/*.js`, {
        ignore: [
            `${projectRoot}${modulePath}/src/core.js`,
            `${projectRoot}${modulePath}/src/init.js`
        ]
    })

    source.forEach(function (filePath) {
        data.js.push(filePath.replace(projectRoot, ''))
    })

    // Load the initialization source
    if (fs.existsSync(`${projectRoot}${modulePath}/src/init.js`)) {
        data.js.push(`${modulePath}/src/init.js`)
    } else {
        return console.error(`Module "${moduleId}" is missing "init.js"`)
    }


    // Load assets, if exists
    if (fs.existsSync(`${projectRoot}${modulePath}/assets`)) {
        data.html = glob.sync(`${projectRoot}${modulePath}/assets/*.html`).map(function (htmlPath) {
            return htmlPath.replace(projectRoot, '')
        })
        data.css = glob.sync(`${projectRoot}${modulePath}/assets/*.less`).map(function (cssPath) {
            return cssPath.replace(projectRoot, '')
        })

        data.html.forEach(function (htmlPath) {
            htmlPath = htmlPath.replace(projectRoot, '')

            const filename = path.basename(htmlPath, '.html')
            data.replaces[`${moduleId}_html_${filename}`] = htmlPath
        })

        data.css.forEach(function (cssPath) {
            cssPath = cssPath.replace(projectRoot, '')
            const filename = path.basename(cssPath, '.less')
            data.replaces[`${moduleId}_css_${filename}`] = cssPath
        })
    }

    return data
}

/**
 * Parse all modules inside /src/modules and generate info objects
 * from each with generateModule().
 */
function generateModules () {
    let modules = []

    fs.readdirSync(`${projectRoot}/src/modules/`).forEach(function (moduleDir) {
        if (!fs.existsSync(`${projectRoot}/src/modules/${moduleDir}/module.json`)) {
            return false
        }

        const info = JSON.parse(fs.readFileSync(`${projectRoot}/src/modules/${moduleDir}/module.json`, 'utf8'))

        if (argv.only && argv.only !== info.id && info.id !== 'interface') {
            console.log(`Ignoring module ${info.id}`)

            return false
        }

        if (argv.ignore && argv.ignore.split(',').includes(info.id)) {
            console.log(`Ignoring module ${info.id}`)

            return false
        }

        modules.push(generateModule(info.id, moduleDir))
    })

    return modules
}

function generateOverflowModule () {
    const modules = generateModules()

    // Store information from all modules as a single module to be build.
    let overflow = {
        js: [],
        html: {},
        css: {},
        replaces: {},
        lang: {}
    }

    overflow.js = overflow.js.concat([
        `/src/header.js`,
        `/src/event-scope.js`,
        `/src/utils.js`,
        `/src/ready.js`,
        `/src/configs.js`,
        `/src/language.js`,
        `/src/settings.js`,
        `/src/map-data.js`,
        `/src/ui.js`,
        `/src/init.js`,
        `/src/libs/lockr.js`
    ])

    // Generate the common translations
    const coreLangFiles = glob.sync(`${projectRoot}/src/lang/*.json`).map(function (langPath) {
        return langPath.replace(projectRoot, '')
    })

    // Generate the common replaces
    overflow.replaces['overflow_name'] = pkg.name
    overflow.replaces['overflow_version'] = pkg.version + (argv.dev ? '-dev' : '')
    overflow.replaces['overflow_author_name'] = pkg.author.name
    overflow.replaces['overflow_author_url'] = pkg.author.url
    overflow.replaces['overflow_author_email'] = pkg.author.email
    overflow.replaces['overflow_author'] = JSON.stringify(pkg.author)
    overflow.replaces['overflow_date'] = new Date().toUTCString()
    overflow.replaces['overflow_lang'] = `~read-file:/tmp/i18n.json`

    // Move all modules information to a single module (overflow)
    modules.forEach(function (module) {
        // js
        overflow.js = overflow.js.concat(module.js)

        // html
        module.html.forEach(function (htmlPath) {
            overflow.html[`/tmp${htmlPath}`] = htmlPath
        })

        // css
        module.css.forEach(function (lessPath) {
            const cssPath = lessPath.replace(/\.less$/, '.css')
            overflow.css[`/tmp${cssPath}`] = lessPath
        })

        // lang
        if (module.lang) {
            overflow.replaces[`${module.id}_lang`] = `~read-file:/tmp/src/modules/${module.dir}/lang/lang.json`
        }

        // replaces
        for (let id in module.replaces) {
            const value = module.replaces[id]

            // If the replace value is a file, create a template to
            // grunt replace later.
            if (fs.existsSync(`${projectRoot}/${value}`)) {
                let filePath = value
                const ext = path.extname(value)

                if (ext === '.less') {
                    filePath = filePath.replace(/\.less$/, '.css')
                }

                // lang replaces already have the temporary path included.
                if (id !== `${module.id}_lang`) {
                    filePath = `/tmp${filePath}`
                }

                overflow.replaces[id] = `~read-file:${filePath}`
            } else {
                overflow.replaces[id] = value
            }   
        }
    })

    overflow.js.push(`/src/footer.js`)

    // Load core assets, if exists
    if (fs.existsSync(`${projectRoot}/src/assets`)) {
        fs.mkdirSync(`${projectRoot}/tmp/src/assets`, {
            recursive: true
        })

        glob.sync(`${projectRoot}/src/assets/*.html`).forEach(function (htmlPath) {
            htmlPath = htmlPath.replace(projectRoot, '')

            const filename = path.basename(htmlPath, '.html')

            overflow.replaces[`overflow_html_${filename}`] = `~read-file:/tmp${htmlPath}`
            overflow.html[`${projectRoot}/tmp${htmlPath}`] = `${projectRoot}${htmlPath}`
        })

        glob.sync(`${projectRoot}/src/assets/*.less`).forEach(function (lessPath) {
            lessPath = lessPath.replace(projectRoot, '')

            const filename = path.basename(lessPath, '.less')

            overflow.replaces[`overflow_css_${filename}`] = `~read-file:/tmp${lessPath}`
            overflow.css[`/tmp${lessPath}`] = `${lessPath}`
        })
    }

    return overflow
}

function replaceText (source, token, replace) {
    let index = 0

    do {
        source = source.replace(token, replace)
    } while((index = source.indexOf(token, index + 1)) > -1)

    return source
}

init()