define('two/about/ui', [
    'two/ui'
], function (
    interfaceOverflow
) {
    let $scope
    
    const selectTab = function (tabType) {
        $scope.selectedTab = tabType
    }

    const init = function () {
        $opener = interfaceOverflow.addMenuButton('About', 100)

        $opener.addEventListener('click', function () {
            buildWindow()
        })

        interfaceOverflow.addTemplate('twoverflow_about_window', `{: about_html_main :}`)
        interfaceOverflow.addStyle('{: about_css_style :}')
    }

    const buildWindow = function () {
        $scope = $rootScope.$new()
        $scope.selectTab = selectTab

        windowManagerService.getModal('!twoverflow_about_window', $scope)
    }

    return init
})
