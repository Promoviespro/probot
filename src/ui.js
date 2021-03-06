define('two/ui', [
    'conf/conf',
    'conf/cdn',
    'two/ready'
], function (
    conf,
    cdnConf,
    ready
) {
    let interfaceOverflow = {}
    let templates = {}
    let initialized = false
    let $menu

    let $head = document.querySelector('head')
    let httpService = injector.get('httpService')
    let templateManagerService = injector.get('templateManagerService')
    let $templateCache = injector.get('$templateCache')

    templateManagerService.load = function (templateName, onSuccess, opt_onError) {
        let path

        const success = function (data, status, headers, config) {
            $templateCache.put(path.substr(1), data)

            if (angular.isFunction(onSuccess)) {
                onSuccess(data, status, headers, config)
            }

            if (!$rootScope.$$phase) {
                $rootScope.$apply()
            }
        }

        const error = function (data, status, headers, config) {
            if (angular.isFunction(opt_onError)) {
                opt_onError(data, status, headers, config)
            }
        }

        if (0 !== templateName.indexOf('!')) {
            path = conf.TEMPLATE_PATH_EXT.join(templateName)
        } else {
            path = templateName.substr(1)
        }

        if ($templateCache.get(path.substr(1))) {
            success($templateCache.get(path.substr(1)), 304)
        } else {
            if (cdnConf.versionMap[path]) {
                httpService.get(path, success, error)
            } else {
                success(templates[path], 304)
            }
        }
    }

    interfaceOverflow.init = function () {
        if (initialized) {
            return false
        }

        let $wrapper = document.querySelector('#wrapper')
        let $container = document.createElement('div')
        let $mainButton = document.createElement('div')

        $container.className = 'two-menu-container'
        $wrapper.appendChild($container)

        $mainButton.className = 'two-main-button'
        $mainButton.style.display = 'none'
        $container.appendChild($mainButton)

        $menu = document.createElement('div')
        $menu.className = 'two-menu'
        $container.appendChild($menu)

        initialized = true
        interfaceOverflow.addStyle('___overflow_css_style')

        ready(function () {
            $mainButton.style.display = 'block'
        }, ['map'])
    }

    interfaceOverflow.addTemplate = function (path, data) {
        templates[path] = data
    }

    interfaceOverflow.addStyle = function (styles) {
        let $style = document.createElement('style')
        $style.type = 'text/css'
        $style.appendChild(document.createTextNode(styles))
        $head.appendChild($style)
    }

    interfaceOverflow.addMenuButton = function (label, order, _tooltip) {
        let $button = document.createElement('div')
        $button.className = 'btn-border btn-orange button'
        $button.innerHTML = label
        $button.style.order = order
        $menu.appendChild($button)

        if (typeof _tooltip === 'string') {
            $button.addEventListener('mouseenter', function (event) {
                $rootScope.$broadcast(eventTypeProvider.TOOLTIP_SHOW, 'twoverflow-tooltip', _tooltip, true, event)
            })

            $button.addEventListener('mouseleave', function () {
                $rootScope.$broadcast(eventTypeProvider.TOOLTIP_HIDE, 'twoverflow-tooltip')
            })
        }

        return $menu.appendChild($button)
    }

    interfaceOverflow.addDivisor = function (order) {
        let $div = document.createElement('div')
        $div.className = 'divisor'
        $div.style.order = order
        $menu.appendChild($div)
    }

    interfaceOverflow.isInitialized = function () {
        return initialized
    }

    return interfaceOverflow
})

require([
    'two/ui'
], function (interfaceOverflow) {
    if (interfaceOverflow.isInitialized()) {
        return false
    }

    interfaceOverflow.init()
})
