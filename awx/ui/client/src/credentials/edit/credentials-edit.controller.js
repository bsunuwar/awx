/*************************************************
 * Copyright (c) 2016 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/

export default ['$scope', '$rootScope', '$compile', '$location',
    '$log', '$stateParams', 'CredentialForm', 'Rest', 'Alert',
    'ProcessErrors', 'ClearScope', 'Prompt', 'GetBasePath', 'GetChoices',
    'KindChange', 'BecomeMethodChange', 'Empty', 'OwnerChange',
    'FormSave', 'Wait', '$state', 'CreateSelect2', 'Authorization', 'i18n',
    function($scope, $rootScope, $compile, $location, $log,
    $stateParams, CredentialForm, Rest, Alert, ProcessErrors, ClearScope, Prompt,
    GetBasePath, GetChoices, KindChange, BecomeMethodChange, Empty, OwnerChange, FormSave, Wait,
    $state, CreateSelect2, Authorization, i18n) {

        ClearScope();

        var defaultUrl = GetBasePath('credentials'),
            form = CredentialForm,
            base = $location.path().replace(/^\//, '').split('/')[0],
            master = {},
            id = $stateParams.credential_id;

        init();

        function init() {
            $scope.id = id;
            $scope.$watch('credential_obj.summary_fields.user_capabilities.edit', function(val) {
                if (val === false) {
                    $scope.canAdd = false;
                }
            });

            $scope.canShareCredential = false;
            Wait('start');
            if (!$rootScope.current_user) {
                Authorization.restoreUserInfo();
            }
            GetChoices({
                scope: $scope,
                url: defaultUrl,
                field: 'kind',
                variable: 'credential_kind_options',
                callback: 'choicesReadyCredential'
            });

            GetChoices({
                scope: $scope,
                url: defaultUrl,
                field: 'become_method',
                variable: 'become_options'
            });

            if ($rootScope.current_user && $rootScope.current_user.is_superuser) {
                $scope.canShareCredential = true;
            } else {
                Rest.setUrl(`/api/v1/users/${$rootScope.current_user.id}/admin_of_organizations`);
                Rest.get()
                    .success(function(data) {
                        $scope.canShareCredential = (data.count) ? true : false;
                        Wait('stop');
                    }).error(function(data, status) {
                        ProcessErrors($scope, data, status, null, { hdr: 'Error!', msg: 'Failed to find if users is admin of org' + status });
                    });
            }

            $scope.$watch('organization', function(val) {
                if (val === undefined) {
                    $scope.permissionsTooltip = i18n._('Credentials are only shared within an organization. Assign credentials to an organization to delegate credential permissions. The organization cannot be edited after credentials are assigned.');
                } else {
                    $scope.permissionsTooltip = '';
                }
            });

            setAskCheckboxes();
            OwnerChange({ scope: $scope });
            $scope.$watch("ssh_key_data", function(val) {
                if (val === "" || val === null || val === undefined) {
                    $scope.keyEntered = false;
                    $scope.ssh_key_unlock_ask = false;
                    $scope.ssh_key_unlock = "";
                } else {
                    $scope.keyEntered = true;
                }
            });
        }

        function setAskCheckboxes() {
            var fld, i;
            for (fld in form.fields) {
                if (form.fields[fld].type === 'sensitive' && $scope[fld] === 'ASK') {
                    // turn on 'ask' checkbox for password fields with value of 'ASK'
                    $("#" + form.name + "_" + fld + "_input").attr("type", "text");
                    $("#" + form.name + "_" + fld + "_show_input_button").html("Hide");
                    $("#" + fld + "-clear-btn").attr("disabled", "disabled");
                    $scope[fld + '_ask'] = true;
                } else {
                    $scope[fld + '_ask'] = false;
                    $("#" + fld + "-clear-btn").removeAttr("disabled");
                }
                master[fld + '_ask'] = $scope[fld + '_ask'];
            }

            // Set kind field to the correct option
            for (i = 0; i < $scope.credential_kind_options.length; i++) {
                if ($scope.kind === $scope.credential_kind_options[i].value) {
                    $scope.kind = $scope.credential_kind_options[i];
                    break;
                }
            }
        }
        if ($scope.removeChoicesReady) {
            $scope.removeChoicesReady();
        }
        $scope.removeChoicesReady = $scope.$on('choicesReadyCredential', function() {
            // Retrieve detail record and prepopulate the form
            Rest.setUrl(defaultUrl + ':id/');
            Rest.get({ params: { id: id } })
                .success(function(data) {
                    if (data && data.summary_fields &&
                        data.summary_fields.organization &&
                        data.summary_fields.organization.id) {
                        $scope.needsRoleList = true;
                    } else {
                        $scope.needsRoleList = false;
                    }

                    $scope.credential_name = data.name;

                    var i, fld;


                    for (fld in form.fields) {
                        if (data[fld] !== null && data[fld] !== undefined) {
                            $scope[fld] = data[fld];
                            master[fld] = $scope[fld];
                        }
                        if (form.fields[fld].type === 'lookup' && data.summary_fields[form.fields[fld].sourceModel]) {
                            $scope[form.fields[fld].sourceModel + '_' + form.fields[fld].sourceField] =
                                data.summary_fields[form.fields[fld].sourceModel][form.fields[fld].sourceField];
                            master[form.fields[fld].sourceModel + '_' + form.fields[fld].sourceField] =
                                $scope[form.fields[fld].sourceModel + '_' + form.fields[fld].sourceField];
                        }
                    }

                    if (!Empty($scope.user)) {
                        $scope.owner = 'user';
                    } else {
                        $scope.owner = 'team';
                    }
                    master.owner = $scope.owner;

                    for (i = 0; i < $scope.become_options.length; i++) {
                        if ($scope.become_options[i].value === data.become_method) {
                            $scope.become_method = $scope.become_options[i];
                            break;
                        }
                    }

                    if ($scope.become_method && $scope.become_method.value === "") {
                        $scope.become_method = null;
                    }
                    master.become_method = $scope.become_method;

                    $scope.$watch('become_method', function(val) {
                        if (val !== null) {
                            if (val.value === "") {
                                $scope.become_username = "";
                                $scope.become_password = "";
                            }
                        }
                    });

                    for (i = 0; i < $scope.credential_kind_options.length; i++) {
                        if ($scope.credential_kind_options[i].value === data.kind) {
                            $scope.kind = $scope.credential_kind_options[i];
                            break;
                        }
                    }

                    KindChange({
                        scope: $scope,
                        form: form,
                        reset: false
                    });

                    master.kind = $scope.kind;

                    CreateSelect2({
                        element: '#credential_become_method',
                        multiple: false
                    });

                    CreateSelect2({
                        element: '#credential_kind',
                        multiple: false
                    });

                    switch (data.kind) {
                        case 'aws':
                            $scope.access_key = data.username;
                            $scope.secret_key = data.password;
                            master.access_key = $scope.access_key;
                            master.secret_key = $scope.secret_key;
                            break;
                        case 'ssh':
                            $scope.ssh_password = data.password;
                            master.ssh_password = $scope.ssh_password;
                            break;
                        case 'rax':
                            $scope.api_key = data.password;
                            master.api_key = $scope.api_key;
                            break;
                        case 'gce':
                            $scope.email_address = data.username;
                            $scope.project = data.project;
                            break;
                        case 'azure':
                            $scope.subscription = data.username;
                            break;
                    }
                    $scope.credential_obj = data;

                    $scope.$emit('credentialLoaded');
                    Wait('stop');
                })
                .error(function(data, status) {
                    ProcessErrors($scope, data, status, form, {
                        hdr: 'Error!',
                        msg: 'Failed to retrieve Credential: ' + $stateParams.id + '. GET status: ' + status
                    });
                });
        });

        // Save changes to the parent
        $scope.formSave = function() {
            if ($scope[form.name + '_form'].$valid) {
                FormSave({ scope: $scope, mode: 'edit' });
            }
        };

        // Handle Owner change
        $scope.ownerChange = function() {
            OwnerChange({ scope: $scope });
        };

        // Handle Kind change
        $scope.kindChange = function() {
            KindChange({ scope: $scope, form: form, reset: true });
        };

        $scope.becomeMethodChange = function() {
            BecomeMethodChange({ scope: $scope });
        };

        $scope.formCancel = function() {
            $state.transitionTo('credentials');
        };

        // Related set: Add button
        $scope.add = function(set) {
            $rootScope.flashMessage = null;
            $location.path('/' + base + '/' + $stateParams.id + '/' + set + '/add');
        };

        // Related set: Edit button
        $scope.edit = function(set, id) {
            $rootScope.flashMessage = null;
            $location.path('/' + base + '/' + $stateParams.id + '/' + set + '/' + id);
        };

        // Related set: Delete button
        $scope['delete'] = function(set, itm_id, name, title) {
            $rootScope.flashMessage = null;

            var action = function() {
                var url = defaultUrl + id + '/' + set + '/';
                Rest.setUrl(url);
                Rest.post({
                        id: itm_id,
                        disassociate: 1
                    })
                    .success(function() {
                        $('#prompt-modal').modal('hide');
                        // @issue: OLD SEARCH
                        // $scope.search(form.related[set].iterator);
                    })
                    .error(function(data, status) {
                        $('#prompt-modal').modal('hide');
                        ProcessErrors($scope, data, status, null, {
                            hdr: 'Error!',
                            msg: 'Call to ' + url + ' failed. POST returned status: ' + status
                        });
                    });
            };

            Prompt({
                hdr: i18n._('Delete'),
                body: '<div class="Prompt-bodyQuery">' + i18n.sprintf(i18n._('Are you sure you want to remove the %s below from %s?'), title, $scope.name) + '</div><div class="Prompt-bodyTarget">' + name + '</div>',
                action: action,
                actionText: i18n._('DELETE')
            });

        };

        // Password change
        $scope.clearPWConfirm = function(fld) {
            // If password value changes, make sure password_confirm must be re-entered
            $scope[fld] = '';
            $scope[form.name + '_form'][fld].$setValidity('awpassmatch', false);
        };

        // Respond to 'Ask at runtime?' checkbox
        $scope.ask = function(fld, associated) {
            if ($scope[fld + '_ask']) {
                $scope[fld] = 'ASK';
                $("#" + form.name + "_" + fld + "_input").attr("type", "text");
                $("#" + form.name + "_" + fld + "_show_input_button").html("Hide");
                if (associated !== "undefined") {
                    $("#" + form.name + "_" + fld + "_input").attr("type", "password");
                    $("#" + form.name + "_" + fld + "_show_input_button").html("Show");
                    $scope[associated] = '';
                    $scope[form.name + '_form'][associated].$setValidity('awpassmatch', true);
                }
            } else {
                $scope[fld] = '';
                $("#" + form.name + "_" + fld + "_input").attr("type", "password");
                $("#" + form.name + "_" + fld + "_show_input_button").html("Show");
                if (associated !== "undefined") {
                    $("#" + form.name + "_" + fld + "_input").attr("type", "text");
                    $("#" + form.name + "_" + fld + "_show_input_button").html("Hide");
                    $scope[associated] = '';
                    $scope[form.name + '_form'][associated].$setValidity('awpassmatch', true);
                }
            }
        };

        $scope.clear = function(fld, associated) {
            $scope[fld] = '';
            $scope[associated] = '';
            $scope[form.name + '_form'][associated].$setValidity('awpassmatch', true);
            $scope[form.name + '_form'].$setDirty();
        };
    }
];