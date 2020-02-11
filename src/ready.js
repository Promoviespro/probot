define('two/ready', [
    'conf/gameStates'
], function (
    GAME_STATES
) {
    const ready = function (callback, which) {
        which = which || ['map']

        const readyStep = function (item) {
            which = which.filter(function (_item) {
                return _item !== item
            })

            if (!which.length) {
                callback()
            }
        }

        const handlers = {
            'map': function () {
                const mapScope = transferredSharedDataService.getSharedData('MapController')

                if (mapScope.isInitialized) {
                    return readyStep('map')
                }

                $rootScope.$on(eventTypeProvider.MAP_INITIALIZED, function () {
                    readyStep('map')
                })
            },
            'tribe_relations': function () {
                const $player = modelDataService.getSelectedCharacter()

                if ($player) {
                    const $tribeRelations = $player.getTribeRelations()

                    if (!$player.getTribeId() || $tribeRelations) {
                        return readyStep('tribe_relations')
                    }
                }

                const unbind = $rootScope.$on(eventTypeProvider.TRIBE_RELATION_LIST, function () {
                    unbind()
                    readyStep('tribe_relations')
                })
            },
            'initial_village': function () {
                const $gameState = modelDataService.getGameState()

                if ($gameState.getGameState(GAME_STATES.INITIAL_VILLAGE_READY)) {
                    return readyStep('initial_village')
                }

                $rootScope.$on(eventTypeProvider.GAME_STATE_INITIAL_VILLAGE_READY, function () {
                    readyStep('initial_village')
                })
            },
            'all_villages_ready': function () {
                const $gameState = modelDataService.getGameState()

                if ($gameState.getGameState(GAME_STATES.ALL_VILLAGES_READY)) {
                    return readyStep('all_villages_ready')
                }

                $rootScope.$on(eventTypeProvider.GAME_STATE_ALL_VILLAGES_READY, function () {
                    readyStep('all_villages_ready')
                })
            }
        }

        const mapScope = transferredSharedDataService.getSharedData('MapController')

        if (!mapScope) {
            return setTimeout(function () {
                ready(callback, which)
            }, 100)
        }

        which.forEach(function (readyItem) {
            handlers[readyItem]()
        })
    }

    return ready
})
