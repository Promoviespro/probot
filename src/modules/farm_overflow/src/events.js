define('two/farmOverflow/events', [], function () {
    angular.extend(eventTypeProvider, {
        FARM_OVERFLOW_START: 'farm_overflow_start',
        FARM_OVERFLOW_STOP: 'farm_overflow_stop',
        FARM_OVERFLOW_INSTANCE_READY: 'farm_overflow_instance_ready',
        FARM_OVERFLOW_INSTANCE_START: 'farm_overflow_instance_start',
        FARM_OVERFLOW_INSTANCE_STOP: 'farm_overflow_instance_stop',
        FARM_OVERFLOW_INSTANCE_ERROR_NO_TARGETS: 'farm_overflow_instance_error_no_targets',
        FARM_OVERFLOW_INSTANCE_ERROR_NOT_READY: 'farm_overflow_instance_error_not_ready',
        FARM_OVERFLOW_INSTANCE_STEP_ERROR: 'farm_overflow_instance_command_error',
        FARM_OVERFLOW_PRESETS_LOADED: 'farm_overflow_presets_loaded',
        FARM_OVERFLOW_LOGS_UPDATED: 'farm_overflow_log_updated',
        FARM_OVERFLOW_COMMAND_SENT: 'farm_overflow_command_sent',
        FARM_OVERFLOW_IGNORED_TARGET: 'farm_overflow_ignored_target'
    })
})
