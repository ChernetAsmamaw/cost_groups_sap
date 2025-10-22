sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Item"
], function (Controller, MessageToast, JSONModel, Item) {
    "use strict";

    // Utility function to safely parse the OData error response
    function _parseODataError(oError, sDefaultMessage) {
        let sMessage = sDefaultMessage || "An unknown error occurred.";
        try {
            const oErrorJson = JSON.parse(oError.responseText);
            sMessage = oErrorJson.error.message.value || sMessage;
            if (oErrorJson.error.errordetails && oErrorJson.error.errordetails.length > 0) {
                sMessage += ": " + oErrorJson.error.errordetails[0].message;
            }
        } catch (e) {
            sMessage = oError.statusText || sMessage;
        }
        return sMessage;
    }

    return Controller.extend("dccs.ui5.costgroups.controller.AddCostGroup", {
        
        onInit: function () {
            const oViewModel = new JSONModel({
                isEditMode: false,
                pageTitle: "",
                nameGerman: "",
                infoTextGerman: "",
                nameEnglish: "",
                infoTextEnglish: "",
                sortOrder: "",
                costGroupType: "",
                costGroupTypeText: "",
                costGroupId: "",
                mandt: "001",
                langu: "EN"
            });
            this.getView().setModel(oViewModel, "viewModel");

            // Message Manager
            var oMessageManager = sap.ui.getCore().getMessageManager();
            var oMessageModel = oMessageManager.getMessageModel();
            this.getView().setModel(oMessageModel, "message");
            oMessageManager.registerObject(this.getView(), true);

            this._loadCostGroupTypes();
            this._loadDropdownData();

            const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteCostGroupDetail").attachPatternMatched(this._onObjectMatched, this);
            oRouter.getRoute("RouteAddCostGroup").attachPatternMatched(this._onAddCostGroup, this);
        },

        _loadDropdownData: function (fnCallback) {
			const oModel = this.getOwnerComponent().getModel();
			const aRequests = [
				new Promise((resolve) => {
					oModel.read("/ZB_CNG_CIRC_CA", {
						success: (oData) => {
							const oCircumstancesModel = new JSONModel(oData.results);
							this.getView().setModel(oCircumstancesModel, "circumstances");
							resolve();
						},
						error: () => {
							MessageToast.show("Failed to load circumstances.");
							resolve();
						}
					});
				}),
				new Promise((resolve) => {
					oModel.read("/ZB_CNG_CALOC_CA", {
						success: (oData) => {
							const aCostAllocations = oData.results.map(oItem => {
								return {
									cost_alloc: oItem.valpos.slice(-2), // "0001" -> "01" to match the ZCA_CIRCUMS DB
									cost_alloc_text: oItem.cost_alloc_text
								};
							});
							const oCostAllocationsModel = new JSONModel(aCostAllocations);
							this.getView().setModel(oCostAllocationsModel, "costAllocations");
							resolve();
						},
						error: () => {
							MessageToast.show("Failed to load cost allocations.");
							resolve();
						}
					});
				})
			];

			Promise.all(aRequests).then(() => {
				if (fnCallback) {
					fnCallback();
				}
			});
		},

        onNavBack: function () {
            const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("RouteCostGroups");
        },
        
        _loadCostGroupTypes: function() {
            return new Promise((resolve, reject) => {
                const oCostGroupTypesModel = new JSONModel();
                this.getView().setModel(oCostGroupTypesModel, "costGroupTypes"); 
                
                const oCgrtyModel = this.getOwnerComponent().getModel("xdccsxcng_cgrty");

                if (!oCgrtyModel) {
                    MessageToast.show("Cost Group Type service model not found.");
                    return reject();
                }

                // VERIFIED WORKING PATH: "/xdccsxcng_cgrty"
                oCgrtyModel.read("/xdccsxcng_cgrty", { 
                    success: (oData) => {
                        const aCostGroupTypes = oData.results.map(oType => ({
                            key: oType.cost_grp_type,       
                            value: oType.costgrptype_text   
                        }));
                        
                        oCostGroupTypesModel.setData(aCostGroupTypes); 
                        resolve();
                    },
                    error: (oError) => {
                        MessageToast.show("Error loading Cost Group Types.");
                        reject(oError);
                    }
                });
            });
        },
        

        
         _onObjectMatched: function (oEvent) {
            const oViewModel = this.getView().getModel("viewModel");
            const costGroupId = oEvent.getParameter("arguments").costGroupId;
            const oModel = this.getOwnerComponent().getModel();
            
            oViewModel.setProperty("/pageTitle", this._getText("editCostGroupTitle"));
            oViewModel.setProperty("/isEditMode", true);

            // Construct the path for the Cost Group entity, which will be used to bind the SmartTable
            const sPath = "/ZSCOSTGRP_CASet(CostGrpId='" + costGroupId + "',Mandt='001')";

            oModel.read(sPath, {
                urlParameters: {
                    "$expand": "ToCircumstance"
                },
                // Change to fat arrow function to retain 'this' context for the view/controller
                success: (oData) => { 
                    oViewModel.setProperty("/sortOrder", oData.SortOrder);
                    oViewModel.setProperty("/costGroupType", oData.CostGrpTypeNo);
                    oViewModel.setProperty("/costGroupTypeText", oData.CostGrpTypeText);
                    
                    // FIX: Load the backend data into the properties bound to the UI (nameGerman/infoTextGerman)
                    oViewModel.setProperty("/nameGerman", oData.CostGrpName || "");
                    oViewModel.setProperty("/infoTextGerman", oData.CostGrpInfoTxt || "");
                    
                    // Set the secondary (English) fields to the same values temporarily
                    oViewModel.setProperty("/nameEnglish", oData.CostGrpName || "");
                    oViewModel.setProperty("/infoTextEnglish", oData.CostGrpInfoTxt || "");
                    
                    oViewModel.setProperty("/costGroupId", oData.CostGrpId);
                    oViewModel.setProperty("/mandt", oData.Mandt);
                    oViewModel.setProperty("/langu", oData.Langu);

                    const oCircumstancesModel = new JSONModel(oData.ToCircumstance.results);
                    this.getView().setModel(oCircumstancesModel, "costGroupCircumstances");
                    
                    // ⭐ FIX: Call the function to set the SmartTable binding path using the full entity path
                    this.onCostGroupContextSet(sPath);

                },
                error: function (oError) {
                    sap.m.MessageToast.show("Error loading cost group data");
                    console.error("OData Read Error:", oError);
                }
            });
        },


        _onAddCostGroup: function (oEvent) {
            const oViewModel = this.getView().getModel("viewModel");

            oViewModel.setProperty("/pageTitle", this._getText("addCostGroupTitle"));
            oViewModel.setProperty("/isEditMode", false);
            
            oViewModel.setProperty("/sortOrder", "");
            oViewModel.setProperty("/costGroupType", ""); 
            oViewModel.setProperty("/costGroupTypeText", "New Cost Group");
            
            // FIX: Clear the properties bound to the UI
            oViewModel.setProperty("/nameGerman", "");
            oViewModel.setProperty("/infoTextGerman", "");
            
            // Clear the secondary properties as well
            oViewModel.setProperty("/nameEnglish", "");
            oViewModel.setProperty("/infoTextEnglish", "");
            
            oViewModel.setProperty("/costGroupId", ""); 
            oViewModel.setProperty("/mandt", "001");
            oViewModel.setProperty("/langu", "EN"); // Setting default language to English
        },
        
        // --- FIX: Use nameGerman/infoTextGerman for the final payload ---
        onSave: function () {
            if (!this._validateInputs()) {
                MessageToast.show("Please correct the validation errors.");
                return;
            }

            const oViewModel = this.getView().getModel("viewModel");
            const oModel = this.getOwnerComponent().getModel();
            const that = this;

            // 1. Validation (Use the properties bound to the form fields)
            const costGroupName = oViewModel.getProperty("/nameGerman"); // Use /nameGerman for name
            const costGroupInfoTxt = oViewModel.getProperty("/infoTextGerman"); // Use /infoTextGerman for info text
            const sortOrder = oViewModel.getProperty("/sortOrder");
            const costGroupType = oViewModel.getProperty("/costGroupType"); 
            
            if (!costGroupName || !costGroupInfoTxt || !sortOrder || !costGroupType) {
                 sap.m.MessageToast.show("Please fill all required fields.");
                 return;
            }

            const isEdit = oViewModel.getProperty("/isEditMode"); 
            
            // 2. Base Payload
            let oData = {
                Mandt: oViewModel.getProperty("/mandt"),
                SortOrder: parseInt(sortOrder),
                CostGrpTypeNo: costGroupType,
                // FIX: Map the UI fields to the OData fields
                CostGrpName: costGroupName, 
                CostGrpInfoTxt: costGroupInfoTxt, 
                Langu: oViewModel.getProperty("/langu") || "EN" // Ensure language is set
            };

            // 3. Execution (Create/Update logic is correct)
            if (isEdit) {
                oData.CostGrpId = oViewModel.getProperty("/costGroupId");
                const sPath = `/ZSCOSTGRP_CASet(CostGrpId='${oData.CostGrpId}',Mandt='${oData.Mandt}')`;
                
                oModel.update(sPath, oData, {
                    success: () => {
                        that.mySuccessHandler({ message: that._getText("updateSuccessMessage") });
                        that.onNavBack();
                    },
                    error: (oError) => {
                        that.myErrorHandler(oError, that._getText("updateErrorMessage"));
                    }
                });
            } else {
                oModel.create("/ZSCOSTGRP_CASet", oData, {
                    success: () => {
                        that.mySuccessHandler({ message: that._getText("createSuccessMessage") });
                        that.onNavBack();
                    },
                    error: (oError) => {
                        that.myErrorHandler(oError, that._getText("createErrorMessage"));
                    }
                });
            }
        },

        onCancel: function () {
            const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("RouteCostGroups");
        },

        _generateNewId: function () { return ""; },

        _getText: function (sKey, aArgs) {
            const oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            return oBundle.getText(sKey, aArgs);
        },

        mySuccessHandler: function (oSuccessMessage) {
            MessageToast.show(oSuccessMessage.message);
        },

                myErrorHandler: function (oError, sDefaultMessage) {
            // OData V2 models push their messages to the message manager automatically.
            // We just need to make sure the popover is open.
            // No need for manual parsing.
        },

        _showTechnicalDetails: function (oErrorMessage) { /* ... */ },

        // In AddCostGroup.controller.js (or wherever the logic resides)
        onCostGroupContextSet: function(sCostGroupPath) {
            var oSmartTable = this.byId("circumstanceSmartTable");
            
            // Bind the Smart Table to the navigation property 'ToCircumstance' relative to the Cost Group context.
            // The Smart Table will handle fetching /CostGroupSet('ID')/ToCircumstance.
            oSmartTable.setTableBindingPath(sCostGroupPath + "/ToCircumstance");
        },

        _validateInputs: function () {
            var oView = this.getView();
            var oViewModel = oView.getModel("viewModel");
            var aInputs = [
                oView.byId("nameGermanInput"),
                oView.byId("infoTextGermanInput"),
                oView.byId("nameEnglishInput"),
                oView.byId("infoTextEnglishInput"),
                oView.byId("sortOrderInput"),
                oView.byId("costGroupTypeSelect")
            ];
            var bValidationError = false;
            var oMessageManager = sap.ui.getCore().getMessageManager();
            oMessageManager.removeAllMessages();

            // Check required fields
            aInputs.forEach(function (oInput) {
                var sValue = "";
                if (oInput.getMetadata().getName() === "sap.m.Select") {
                    sValue = oInput.getSelectedKey();
                } else {
                    sValue = oInput.getValue();
                }

                if (!sValue) {
                    var sLabel = oView.byId(oInput.getId().replace("Input", "Label") || oInput.getId().replace("Select", "Label")).getText();
                    oMessageManager.addMessage(new sap.ui.core.message.Message({
                        message: "Please fill in the required field: " + sLabel,
                        type: sap.ui.core.MessageType.Error,
                        target: oInput.getId() + "/value",
                        processor: oView.getModel("viewModel")
                    }));
                    bValidationError = true;
                }
            });

            // Validate circumstances table
            var oTable = this.byId("circumstanceTable");
            var aItems = oTable.getItems();
            aItems.forEach(function (oItem, i) {
                var oCells = oItem.getCells();
                var oTaxShareInput = oCells[2];
                var fTaxShare = parseFloat(oTaxShareInput.getValue());
                var oValidFromPicker = oCells[3];
                var oValidToPicker = oCells[4];
                var dValidFrom = oValidFromPicker.getDateValue();
                var dValidTo = oValidToPicker.getDateValue();

                if (isNaN(fTaxShare) || fTaxShare < 0 || fTaxShare > 100) {
                    oMessageManager.addMessage(new sap.ui.core.message.Message({
                        message: "Tax Share must be between 0 and 100.",
                        type: sap.ui.core.MessageType.Error,
                        target: oTaxShareInput.getId() + "/value",
                        processor: oView.getModel("viewModel")
                    }));
                    bValidationError = true;
                }

                if (dValidFrom && dValidTo && dValidFrom > dValidTo) {
                    oMessageManager.addMessage(new sap.ui.core.message.Message({
                        message: "'Valid From' date must be before 'Valid To' date.",
                        type: sap.ui.core.MessageType.Error,
                        target: oValidFromPicker.getId() + "/value",
                        processor: oView.getModel("viewModel")
                    }));
                    bValidationError = true;
                }
            });

            return !bValidationError;
        },

        formatHighlight: function (sValidFrom, sValidTo) {
            if (!sValidFrom) {
                return "Error"; // No ValidFrom date is an error
            }

            const oCurrentDate = new Date();
            // Set time to 00:00:00 for date-only comparison
            oCurrentDate.setHours(0, 0, 0, 0);

            const oValidFrom = new Date(sValidFrom);
            let oValidTo = sValidTo ? new Date(sValidTo) : new Date(9999, 11, 31);

            // Set time to 00:00:00 for date-only comparison
            oValidFrom.setHours(0, 0, 0, 0);
            oValidTo.setHours(0, 0, 0, 0);

            if (oCurrentDate >= oValidFrom && oCurrentDate <= oValidTo) {
                return "Success"; // Active
            } else if (oCurrentDate < oValidFrom) {
                return "Warning"; // Future
            } else {
                return "Error"; // Past
            }
        },

        onMessagePopoverPress: function (oEvent) {
            var oSourceControl = oEvent.getSource();
            this._getMessagePopover().then(function(oMessagePopover){
                oMessagePopover.openBy(oSourceControl);
            });
        },

        _getMessagePopover: function () {
            var oView = this.getView();

            if (!this._pMessagePopover) {
                this._pMessagePopover = new Promise((resolve) => {
                    sap.ui.require(["sap/m/MessagePopover", "sap/m/MessageItem"], (MessagePopover, MessageItem) => {
                        var oMessagePopover = new MessagePopover({
                            items: {
                                path: "message>/",
                                template: new MessageItem({
                                    type: "{message>type}",
                                    title: "{message>message}",
                                    description: "{message>description}"
                                })
                            }
                        });
                        oView.addDependent(oMessagePopover);
                        resolve(oMessagePopover);
                    });
                });
            }
            return this._pMessagePopover;
        },
    });
});