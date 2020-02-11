define('two/minimap/ui', [
    'two/ui',
    'two/minimap',
    'two/minimap/types/actions',
    'two/minimap/settings',
    'two/minimap/settings/map',
    'two/utils',
    'two/EventScope',
    'two/Settings',
    'helper/util',
    'struct/MapData',
    'cdn',
    'conf/colors'
], function (
    interfaceOverflow,
    minimap,
    ACTION_TYPES,
    SETTINGS,
    SETTINGS_MAP,
    utils,
    EventScope,
    Settings,
    util,
    mapData,
    cdn,
    colors
) {
    let $scope
    let $button
    let $minimapCanvas
    let $crossCanvas
    let $minimapContainer
    let MapController
    let windowWrapper
    let mapWrapper
    let tooltipWrapper
    let tooltipTimeout
    let highlightNames = {
        character: {},
        tribe: {}
    }
    let settings
    const TAB_TYPES = {
        MINIMAP: 'minimap',
        HIGHLIGHTS: 'highlights',
        SETTINGS: 'settings'
    }
    const DEFAULT_TAB = TAB_TYPES.MINIMAP

    const selectTab = function (tab) {
        $scope.selectedTab = tab

        if (tab === TAB_TYPES.MINIMAP) {
            minimap.enableRendering()
        } else {
            minimap.disableRendering()
        }
    }

    const appendCanvas = function () {
        $minimapContainer = document.querySelector('#two-minimap .minimap-container')
        $minimapContainer.appendChild($minimapCanvas)
        $minimapContainer.appendChild($crossCanvas)
    }

    const getTribeData = function (data, callback) {
        socketService.emit(routeProvider.TRIBE_GET_PROFILE, {
            tribe_id: data.id
        }, callback)
    }
    
    const getCharacterData = function (data, callback) {
        socketService.emit(routeProvider.CHAR_GET_PROFILE, {
            character_id: data.id
        }, callback)
    }

    const getVillageData = function (data, callback) {
        mapData.loadTownDataAsync(data.x, data.y, 1, 1, callback)
    }

    const updateHighlightNames = function () {
        Object.keys($scope.highlights.character).forEach(function (id) {
            if (id in highlightNames.character) {
                return
            }

            getCharacterData({
                id: id
            }, function (data) {
                highlightNames.character[id] = data.character_name
            })
        })

        Object.keys($scope.highlights.tribe).forEach(function (id) {
            if (id in highlightNames.tribe) {
                return
            }

            getTribeData({
                id: id
            }, function (data) {
                highlightNames.tribe[id] = data.name
            })
        })
    }

    const showTooltip = function (_, data) {
        tooltipTimeout = setTimeout(function () {
            windowWrapper.appendChild(tooltipWrapper)
            tooltipWrapper.classList.remove('ng-hide')

            MapController.tt.name = data.village.name
            MapController.tt.x = data.village.x
            MapController.tt.y = data.village.y
            MapController.tt.province_name = data.village.province_name
            MapController.tt.points = data.village.points
            MapController.tt.character_name = data.village.character_name || '-'
            MapController.tt.character_points = data.village.character_points || 0
            MapController.tt.tribe_name = data.village.tribe_name || '-'
            MapController.tt.tribe_tag = data.village.tribe_tag || '-'
            MapController.tt.tribe_points = data.village.tribe_points || 0
            MapController.tt.morale = data.village.morale || 0
            MapController.tt.position = {}
            MapController.tt.position.x = data.event.pageX + 50
            MapController.tt.position.y = data.event.pageY + 50
            MapController.tt.visible = true

            const tooltipOffset = tooltipWrapper.getBoundingClientRect()
            const windowOffset = windowWrapper.getBoundingClientRect()
            const tooltipWrapperSpacerX = tooltipOffset.width + 50
            const tooltipWrapperSpacerY = tooltipOffset.height + 50

            onTop = MapController.tt.position.y + tooltipWrapperSpacerY > windowOffset.top + windowOffset.height
            onLeft = MapController.tt.position.x + tooltipWrapperSpacerX > windowOffset.width

            if (onTop) {
                MapController.tt.position.y -= 50
            }

            tooltipWrapper.classList.toggle('left', onLeft)
            tooltipWrapper.classList.toggle('top', onTop)
        }, 50)
    }

    const hideTooltip = function () {
        clearTimeout(tooltipTimeout)
        MapController.tt.visible = false
        tooltipWrapper.classList.add('ng-hide')
        mapWrapper.appendChild(tooltipWrapper)
    }

    const openColorPalette = function (inputType, colorGroup, itemId, itemColor) {
        let modalScope = $rootScope.$new()
        let selectedColor
        let hideReset = true
        let settingId

        modalScope.colorPalettes = colors.palette

        if (inputType === 'setting') {
            settingId = colorGroup
            selectedColor = settings.get(settingId)
            hideReset = false

            modalScope.submit = function () {
                $scope.settings[settingId] = '#' + modalScope.selectedColor
                modalScope.closeWindow()
            }

            modalScope.reset = function () {
                $scope.settings[settingId] = settings.getDefault(settingId)
                modalScope.closeWindow()
            }
        } else if (inputType === 'add_custom_highlight') {
            selectedColor = $scope.addHighlightColor

            modalScope.submit = function () {
                $scope.addHighlightColor = '#' + modalScope.selectedColor
                modalScope.closeWindow()
            }
        } else if (inputType === 'edit_custom_highlight') {
            selectedColor = $scope.highlights[colorGroup][itemId]

            modalScope.submit = function () {
                minimap.addHighlight({
                    id: itemId,
                    type: colorGroup
                }, '#' + modalScope.selectedColor)
                modalScope.closeWindow()
            }
        }

        modalScope.selectedColor = selectedColor.replace('#', '')
        modalScope.hasCustomColors = true
        modalScope.hideReset = hideReset

        modalScope.finishAction = function ($event, color) {
            modalScope.selectedColor = color
        }

        windowManagerService.getModal('modal_color_palette', modalScope)
    }

    const addCustomHighlight = function () {
        minimap.addHighlight($scope.selectedHighlight, $scope.addHighlightColor)
    }

    const saveSettings = function () {
        settings.setAll(settings.decode($scope.settings))
        utils.emitNotif('success', $filter('i18n')('settings_saved', $rootScope.loc.ale, 'minimap'))
    }

    const resetSettings = function () {
        let modalScope = $rootScope.$new()

        modalScope.title = $filter('i18n')('reset_confirm_title', $rootScope.loc.ale, 'minimap')
        modalScope.text = $filter('i18n')('reset_confirm_text', $rootScope.loc.ale, 'minimap')
        modalScope.submitText = $filter('i18n')('reset', $rootScope.loc.ale, 'common')
        modalScope.cancelText = $filter('i18n')('cancel', $rootScope.loc.ale, 'common')
        modalScope.showQuestionMarkIcon = true
        modalScope.switchColors = true

        modalScope.submit = function submit() {
            settings.resetAll()
            utils.emitNotif('success', $filter('i18n')('settings_reset', $rootScope.loc.ale, 'minimap'))
            modalScope.closeWindow()
        }

        modalScope.cancel = function cancel() {
            modalScope.closeWindow()
        }

        windowManagerService.getModal('modal_attention', modalScope)
    }

    const highlightsCount = function () {
        const character = Object.keys($scope.highlights.character).length
        const tribe = Object.keys($scope.highlights.tribe).length
        
        return character + tribe
    }

    const openProfile = function (type, itemId) {
        const handler = type === 'character'
            ? windowDisplayService.openCharacterProfile
            : windowDisplayService.openTribeProfile

        handler(itemId)
    }

    const eventHandlers = {
        addHighlightAutoCompleteSelect: function (item) {
            $scope.selectedHighlight = {
                id: item.id,
                type: item.type,
                name: item.name
            }
        },
        highlightUpdate: function (event) {
            updateHighlightNames()
        },
        highlightAddErrorExists: function (event) {
            utils.emitNotif('error', $filter('i18n')('highlight_add_error_exists', $rootScope.loc.ale, 'minimap'))
        },
        highlightAddErrorNoEntry: function (event) {
            utils.emitNotif('error', $filter('i18n')('highlight_add_error_no_entry', $rootScope.loc.ale, 'minimap'))
        },
        highlightAddErrorInvalidColor: function (event) {
            utils.emitNotif('error', $filter('i18n')('highlight_add_error_invalid_color', $rootScope.loc.ale, 'minimap'))
        },
        onMouseLeaveMinimap: function (event) {
            const mouseUpEvent = new MouseEvent('mouseup', {
                view: window,
                bubbles: true,
                cancelable: true
            })

            hideTooltip()
            $crossCanvas.dispatchEvent(mouseUpEvent)
        },
        onMouseMoveMinimap: function (event) {
            hideTooltip()
            $crossCanvas.style.cursor = 'url(' + cdn.getPath('/img/cursor/grab_pushed.png') + '), move'
        },
        onMouseStopMoveMinimap: function (event) {
            $crossCanvas.style.cursor = ''
        }
    }

    const init = function () {
        settings = minimap.getSettings()
        MapController = transferredSharedDataService.getSharedData('MapController')
        $minimapCanvas = document.createElement('canvas')
        $minimapCanvas.className = 'minimap'
        $crossCanvas = document.createElement('canvas')
        $crossCanvas.className = 'cross'

        minimap.setViewport($minimapCanvas)
        minimap.setCross($crossCanvas)

        tooltipWrapper = document.querySelector('#map-tooltip')
        windowWrapper = document.querySelector('#wrapper')
        mapWrapper = document.querySelector('#map')

        $button = interfaceOverflow.addMenuButton('Minimap', 50)
        $button.addEventListener('click', function () {
            const current = minimap.getMapPosition()

            if (!current) {
                return false
            }

            minimap.setCurrentPosition(current[0], current[1])
            buildWindow()
        })

        interfaceOverflow.addTemplate('twoverflow_minimap_window', `{: minimap_html_main :}`)
        interfaceOverflow.addStyle('{: minimap_css_style :}')
    }

    const buildWindow = function () {
        $scope = $rootScope.$new()
        $scope.SETTINGS = SETTINGS
        $scope.TAB_TYPES = TAB_TYPES
        $scope.selectedTab = DEFAULT_TAB
        $scope.selectedHighlight = false
        $scope.addHighlightColor = '#000000'
        $scope.highlights = minimap.getHighlights()
        $scope.highlightNames = highlightNames
        $scope.actionTypes = Settings.encodeList(ACTION_TYPES, {
            textObject: 'minimap',
            disabled: false
        })
        $scope.autoComplete = {
            type: ['character', 'tribe', 'village'],
            placeholder: $filter('i18n')('placeholder_search', $rootScope.loc.ale, 'minimap'),
            onEnter: eventHandlers.addHighlightAutoCompleteSelect
        }

        // functions
        $scope.selectTab = selectTab
        $scope.openColorPalette = openColorPalette
        $scope.addCustomHighlight = addCustomHighlight
        $scope.removeHighlight = minimap.removeHighlight
        $scope.saveSettings = saveSettings
        $scope.resetSettings = resetSettings
        $scope.highlightsCount = highlightsCount
        $scope.openProfile = openProfile

        settings.injectScope($scope, {
            textObject: 'minimap'
        })

        eventScope = new EventScope('twoverflow_minimap_window')
        eventScope.register(eventTypeProvider.GROUPS_VILLAGES_CHANGED, eventHandlers.highlightUpdate, true)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_EXISTS, eventHandlers.highlightAddErrorExists)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_NO_ENTRY, eventHandlers.highlightAddErrorNoEntry)
        eventScope.register(eventTypeProvider.MINIMAP_HIGHLIGHT_ADD_ERROR_INVALID_COLOR, eventHandlers.highlightAddErrorInvalidColor)
        eventScope.register(eventTypeProvider.MINIMAP_VILLAGE_HOVER, showTooltip)
        eventScope.register(eventTypeProvider.MINIMAP_VILLAGE_BLUR, hideTooltip)
        eventScope.register(eventTypeProvider.MINIMAP_MOUSE_LEAVE, eventHandlers.onMouseLeaveMinimap)
        eventScope.register(eventTypeProvider.MINIMAP_START_MOVE, eventHandlers.onMouseMoveMinimap)
        eventScope.register(eventTypeProvider.MINIMAP_STOP_MOVE, eventHandlers.onMouseStopMoveMinimap)

        windowManagerService.getScreenWithInjectedScope('!twoverflow_minimap_window', $scope)
        updateHighlightNames()
        appendCanvas()
        minimap.enableRendering()
    }

    return init
})
