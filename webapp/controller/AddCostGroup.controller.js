sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("dccs.ui5.costgroups.controller.AddCostGroup", {
        
        onInit: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteCostGroupDetail").attachPatternMatched(this._onObjectMatched, this);
            oRouter.getRoute("RouteAddCostGroup").attachPatternMatched(this._onAddCostGroup, this);
        },

        onNavBack: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("RouteCostGroups");
        },

        _onObjectMatched: function (oEvent) {
            var costGroupId = oEvent.getParameter("arguments").costGroupId;
            var oModel = this.getOwnerComponent().getModel(); // default model
            var oViewModel = new sap.ui.model.json.JSONModel();
            var that = this;
            this.getView().setModel(oViewModel, "viewModel");

            // Set page title for edit mode
            oViewModel.setProperty("/pageTitle", this._getText("editCostGroupTitle"));

            // Read from your new Gateway service
            oModel.read("/ZSCOSTGRP_CASet(CostGrpId='" + costGroupId + "',Mandt='001')", {
                success: function (oData) {
                    // Map fields from your OData response
                    oViewModel.setProperty("/sortOrder", oData.SortOrder);
                    oViewModel.setProperty("/costGroupType", oData.CostGrpTypeNo);
                    oViewModel.setProperty("/costGroupTypeText", oData.CostGrpTypeText);
                    
                    // Set name and info text fields
                    oViewModel.setProperty("/nameGerman", oData.CostGrpName || "");
                    oViewModel.setProperty("/infoTextGerman", oData.CostGrpInfoTxt || "");
                    oViewModel.setProperty("/nameEnglish", oData.CostGrpName || "");
                    oViewModel.setProperty("/infoTextEnglish", oData.CostGrpInfoTxt || "");
                    
                    // Store the cost group ID for updates
                    oViewModel.setProperty("/costGroupId", oData.CostGrpId);
                    oViewModel.setProperty("/mandt", oData.Mandt);
                    oViewModel.setProperty("/langu", oData.Langu);
                    oViewModel.setProperty("/lastChanged", oData.LastChanged);
                },
                error: function (oError) {
                    // Handle error
                    sap.m.MessageToast.show("Error loading cost group data");
                    console.error("OData Read Error:", oError);
                }
            });
        },

        _onAddCostGroup: function (oEvent) {
            var oViewModel = new sap.ui.model.json.JSONModel();
            this.getView().setModel(oViewModel, "viewModel");

            // Set page title for add mode
            oViewModel.setProperty("/pageTitle", this._getText("addCostGroupTitle"));
            
            // Initialize empty form
            oViewModel.setProperty("/sortOrder", "");
            oViewModel.setProperty("/costGroupType", "");
            oViewModel.setProperty("/costGroupTypeText", "");
            oViewModel.setProperty("/nameGerman", "");
            oViewModel.setProperty("/infoTextGerman", "");
            oViewModel.setProperty("/nameEnglish", "");
            oViewModel.setProperty("/infoTextEnglish", "");
            oViewModel.setProperty("/costGroupId", "");
            oViewModel.setProperty("/mandt", "001");
            oViewModel.setProperty("/langu", "EN");
        },

        onSave: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var oModel = this.getOwnerComponent().getModel();
            var that = this;

            // Validate required fields
            var nameGerman = oViewModel.getProperty("/nameGerman");
            var infoTextGerman = oViewModel.getProperty("/infoTextGerman");
            var sortOrder = oViewModel.getProperty("/sortOrder");

            if (!nameGerman || !infoTextGerman || !sortOrder) {
                sap.m.MessageToast.show("Please fill all required fields");
                return;
            }

            // Prepare data for save
            var oData = {
                CostGrpId: oViewModel.getProperty("/costGroupId") || this._generateNewId(),
                Mandt: oViewModel.getProperty("/mandt"),
                SortOrder: parseInt(sortOrder),
                CostGrpTypeNo: oViewModel.getProperty("/costGroupType"),
                CostGrpName: nameGerman, // Using German as primary
                CostGrpInfoTxt: infoTextGerman, // Using German as primary
                Langu: oViewModel.getProperty("/langu") || "EN",
                CostGrpTypeText: oViewModel.getProperty("/costGroupTypeText")
            };

            var isEdit = !!oViewModel.getProperty("/costGroupId");

            if (isEdit) {
                // Update existing record
                var sPath = "/ZSCOSTGRP_CASet(CostGrpId='" + oData.CostGrpId + "',Mandt='" + oData.Mandt + "')";
                oModel.update(sPath, oData, {
                    success: function () {
                        sap.m.MessageToast.show("Cost Group updated successfully");
                        that.onNavBack();
                    },
                    error: function (oError) {
                        sap.m.MessageToast.show("Error updating cost group");
                        console.error("Update Error:", oError);
                    }
                });
            } else {
                // Create new record
                oModel.create("/ZSCOSTGRP_CASet", oData, {
                    success: function () {
                        sap.m.MessageToast.show("Cost Group created successfully");
                        that.onNavBack();
                    },
                    error: function (oError) {
                        sap.m.MessageToast.show("Error creating cost group");
                        console.error("Create Error:", oError);
                    }
                });
            }
        },

        onCancel: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("RouteCostGroups");
        },

        _generateNewId: function () {
            // Generate a new ID - you might want to implement proper ID generation
            // based on your business logic
            return Date.now().toString().substr(-8).padStart(8, '0');
        },

        _getText: function (sKey, aArgs) {
            var oBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            return oBundle.getText(sKey, aArgs);
        }
    });
});