require([
    'two/language',
    'two/ready',
    'two/commandQueue',
    'two/commandQueue/ui',
    'two/commandQueue/events'
], function (
    twoLanguage,
    ready,
    commandQueue,
    commandQueueInterface
) {
    if (commandQueue.initialized) {
        return false
    }

    ready(function () {
        twoLanguage.add('{: command_queue_id :}', {: command_queue_lang :})
        commandQueue.init()
        commandQueueInterface()

        if (commandQueue.getWaitingCommands().length > 0) {
            commandQueue.start(true)
        }
    })
})
