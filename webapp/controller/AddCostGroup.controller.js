sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, MessageToast, JSONModel, MessageBox, Fragment, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("dccs.ui5.costgroups.controller.AddCostGroup", {
        
    // setup view model, message manager, batch groups and route handlers
    onInit: function () {
            this._aPendingDeletes = [];
            this._oOriginalData = [];
            this.getOwnerComponent().getModel().setUseBatch(true);

            this._sChangesetId = "costGroupChangeset";
            // Setting the batch group to deferred allows us to collect all OData calls
            this.getOwnerComponent().getModel().setDeferredGroups([this._sChangesetId]);

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
                langu: "EN",
                hasCircumstanceSelection: false,
                lastCircumstanceTempId: 0,
                headerBindingPath: ""
            });
            this.getView().setModel(oViewModel, "viewModel");

            this._oMessageManager = sap.ui.getCore().getMessageManager();
            var oMessageModel = this._oMessageManager.getMessageModel();
            this.getView().setModel(oMessageModel, "message");
            this._oMessageManager.registerObject(this.getView(), true);

            this._loadCostGroupTypes();
            this._loadDropdownData();

            const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteCostGroupDetail").attachPatternMatched(this._onObjectMatched, this);
            oRouter.getRoute("RouteAddCostGroup").attachPatternMatched(this._onAddCostGroup, this);
        },

    // Navigate back to the Cost Groups list route
    onNavBack: function () {
            const oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("RouteCostGroups");
        },

        // Data Loading

    // Load available Cost Group types into the view model
    _loadCostGroupTypes: function() {
            const oCostGroupTypesModel = new JSONModel();
            this.getView().setModel(oCostGroupTypesModel, "costGroupTypes");
            
            const oCgrtyModel = this.getOwnerComponent().getModel("xdccsxcng_cgrty");
            if (!oCgrtyModel) {
                MessageToast.show("Cost Group Type service model not found.");
                return;
            }

            oCgrtyModel.read("/xdccsxcng_cgrty", { 
                success: (oData) => {
                    const aCostGroupTypes = oData.results.map(oType => ({
                        key: oType.cost_grp_type,       
                        value: oType.costgrptype_text   
                    }));
                    oCostGroupTypesModel.setData(aCostGroupTypes);  
                },
                error: () => {
                    MessageToast.show("Error loading Cost Group Types.");
                }
            });
        },
        
    // Load dropdown reference data (Circumstances and Cost Allocations)
    _loadDropdownData: function (fnCallback) {
            const oModel = this.getOwnerComponent().getModel();
            
            // Load Circumstances (Circid dropdown)
            oModel.read("/ZB_CNG_CIRC_CA", {
                success: (oData) => {
                    this.getView().setModel(new JSONModel(oData.results), "circumstances");
                }
            });

            // Load Cost Allocations (CostAlloc dropdown)
            oModel.read("/ZB_CNG_CALOC_CA", {
                success: (oData) => {
                    // Extract last two characters for cost_alloc key
                    const aCostAllocations = oData.results.map(oItem => ({
                        cost_alloc: oItem.valpos.slice(-2),
                        cost_alloc_text: oItem.cost_alloc_text
                    }));
                    this.getView().setModel(new JSONModel(aCostAllocations), "costAllocations");
                    if (fnCallback) { fnCallback(); }
                }
            });
        },

        // Routing and Initialization

    // Handle routing to edit: load header and its circumstances
    _onObjectMatched: function (oEvent) {
            const oViewModel = this.getView().getModel("viewModel");
            const costGroupId = oEvent.getParameter("arguments").costGroupId;
            const oModel = this.getOwnerComponent().getModel();
            
            // Reset state for edit mode
            this._aPendingDeletes = [];
            
            oViewModel.setProperty("/pageTitle", this._getText("editCostGroupTitle"));
            oViewModel.setProperty("/isEditMode", true);

            // Construct the path to the main Cost Group Entity
            const sPath = `/ZSCOSTGRP_CASet(CostGrpId='${costGroupId}',Mandt='001')`;
            oViewModel.setProperty("/headerBindingPath", sPath);

            oModel.read(sPath, {
                urlParameters: {
                    "$expand": "ToCircumstance"
                },
                success: (oData) => { 
                    oViewModel.setProperty("/sortOrder", oData.SortOrder);
                    oViewModel.setProperty("/costGroupType", oData.CostGrpTypeNo);
                    oViewModel.setProperty("/nameGerman", oData.CostGrpName || "");
                    oViewModel.setProperty("/infoTextGerman", oData.CostGrpInfoTxt || "");
                    oViewModel.setProperty("/nameEnglish", oData.CostGrpName || "");
                    oViewModel.setProperty("/infoTextEnglish", oData.CostGrpInfoTxt || "");
                    oViewModel.setProperty("/costGroupId", oData.CostGrpId);
                    oViewModel.setProperty("/mandt", oData.Mandt);
                    oViewModel.setProperty("/langu", oData.Langu);

                    // Map circumstances and store their individual OData path for independent update/delete
                    const aCircumstancesWithPaths = oData.ToCircumstance.results.map((oItem) => {
                        // Correctly construct the path using both primary keys
                        const sCircumstancePath = `/CircumstanceSet(CostGrpId='${oData.CostGrpId}',CgpcrcId='${oItem.CgpcrcId}')`; 

                        return Object.assign({}, oItem, {
                            // Ensure TaxRate is parsed as a number if it came back as string/decimal
                            TaxRate: parseFloat(oItem.TaxRate || 0),
                            __bindingPath: sCircumstancePath 
                        });
                    });

                    // Store original data for change detection
                    this._oOriginalData = JSON.parse(JSON.stringify(aCircumstancesWithPaths)); 
                    this.getView().setModel(new JSONModel(aCircumstancesWithPaths), "costGroupCircumstances");
                },
                error: (oError) => {
                    MessageToast.show("Error loading cost group data");
                }
            });
        },

    // Initialize the view for creating a new Cost Group
    _onAddCostGroup: function () {
            // Reset state for create mode
            this._aPendingDeletes = [];
            this._oOriginalData = [];
            const oViewModel = this.getView().getModel("viewModel");

            oViewModel.setProperty("/pageTitle", this._getText("addCostGroupTitle"));
            oViewModel.setProperty("/isEditMode", false);
            oViewModel.setProperty("/headerBindingPath", ""); 
            
            // Clear input fields
            oViewModel.setProperty("/sortOrder", "");
            oViewModel.setProperty("/costGroupType", ""); 
            oViewModel.setProperty("/nameGerman", "");
            oViewModel.setProperty("/infoTextGerman", "");
            oViewModel.setProperty("/nameEnglish", "");
            oViewModel.setProperty("/infoTextEnglish", "");
            oViewModel.setProperty("/costGroupId", ""); 
            oViewModel.setProperty("/mandt", "001");
            oViewModel.setProperty("/langu", "EN");

            this.getView().setModel(new JSONModel([]), "costGroupCircumstances");
        },

        //  Management

    // Add a new temporary Circumstance row to the local JSON model
    onAddCircumstance: function () {
            const oViewModel = this.getView().getModel("viewModel");
            const oCircumstancesModel = this.getView().getModel("costGroupCircumstances");
            const aCircumstances = oCircumstancesModel.getProperty("/");
            
            // Generate a temporary negative ID for new items (unique identifier until saved)
            const iTempId = oViewModel.getProperty("/lastCircumstanceTempId") - 1;
            oViewModel.setProperty("/lastCircumstanceTempId", iTempId);

            const oNewCircumstance = {
                Circid: "",
                CostAlloc: "",
                TaxRate: 0.0,
                ValidFrom: new Date(),
                ValidTo: null,
                Status: this._getText("newStatus"),
                __isNew: true,
                __tempId: iTempId,
                __bindingPath: null // New items don't have a path yet
            };

            aCircumstances.push(oNewCircumstance);
            oCircumstancesModel.setProperty("/", aCircumstances);
        },

    // Update selection state when table row selection changes
    onCircumstanceSelectionChange: function (oEvent) {
            const oTable = this.byId("circumstanceTable");
            const oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/hasCircumstanceSelection", oTable.getSelectedItems().length > 0);
        },

    // Mark selected circumstances for deletion and remove them from the local model
    onDeleteCircumstance: function () {
            const oTable = this.byId("circumstanceTable");
            const aSelectedItems = oTable.getSelectedItems();

            if (aSelectedItems.length === 0) {
                MessageToast.show(this._getText("noCircumstanceSelected"));
                return;
            }

            MessageBox.confirm(this._getText("deleteConfirmText"), {
                title: this._getText("deleteConfirmTitle"),
                onClose: (oAction) => {
                    if (oAction === MessageBox.Action.OK) {
                        const oCircumstancesModel = this.getView().getModel("costGroupCircumstances");
                        let aCircumstances = oCircumstancesModel.getProperty("/");

                        aSelectedItems.forEach(oItem => {
                            const oContext = oItem.getBindingContext("costGroupCircumstances");
                            const oCircumstance = oContext.getObject();

                            // Store binding path for backend deletes only if it's an existing item
                            if (oCircumstance.CgpcrcId && oCircumstance.__bindingPath) {
                                this._aPendingDeletes.push(oCircumstance.__bindingPath);
                            } 
                            // Remove from the local JSON model
                            const iIndex = aCircumstances.findIndex(c => 
                                (c.CgpcrcId && c.CgpcrcId === oCircumstance.CgpcrcId) || (c.__tempId === oCircumstance.__tempId)
                            );
                            if (iIndex > -1) {
                                aCircumstances.splice(iIndex, 1);
                            }
                        });

                        oCircumstancesModel.setProperty("/", aCircumstances);
                        oTable.removeSelections(true);
                        this.getView().getModel("viewModel").setProperty("/hasCircumstanceSelection", false);
                        MessageToast.show(this._getText("circumstanceMarkedForDeletion"));
                    }
                }
            });
        },
        
        //  Save Logic (Create/Update with Batch)

    // Save changes: perform header update, circumstance creates/updates/deletes in a batch
    onSave: function () {
            if (!this._validateInputs()) {
                MessageToast.show("Please correct the validation errors.");
                return;
            }

            const oModel = this.getOwnerComponent().getModel();
            const oViewModel = this.getView().getModel("viewModel");
            const oCircumstancesModel = this.getView().getModel("costGroupCircumstances");
            const aCircumstances = oCircumstancesModel.getProperty("/");
            const that = this;

            const isEdit = oViewModel.getProperty("/isEditMode");
            const sCostGroupId = oViewModel.getProperty("/costGroupId");
            const sMandt = oViewModel.getProperty("/mandt");

            // 1. Prepare Header Payload
            const oHeaderData = {
                Mandt: sMandt,
                // HIGH CARE: Ensure SortOrder is an integer
                SortOrder: parseInt(oViewModel.getProperty("/sortOrder")),
                CostGrpTypeNo: oViewModel.getProperty("/costGroupType"),
                CostGrpName: oViewModel.getProperty("/nameGerman"),
                CostGrpInfoTxt: oViewModel.getProperty("/infoTextGerman"),
                Langu: oViewModel.getProperty("/langu") || "EN"
            };

            // 2. Helper to format a Circumstance payload
            const getCircumstancePayload = (oItem) => {
                const oPayload = {
                    Circid: oItem.Circid,
                    CostAlloc: oItem.CostAlloc,
                    // HIGH CARE: Ensure TaxRate is explicitly sent as a string (best practice for Edm.Decimal)
                    TaxRate: (parseFloat(oItem.TaxRate) || 0).toFixed(2).toString(), 
                    // Ensure Date objects are used for OData
                    ValidFrom: oItem.ValidFrom ? this._parseDate(oItem.ValidFrom) : null,
                    ValidTo: oItem.ValidTo ? this._parseDate(oItem.ValidTo) : null
                };
                // Remove the key property for updates, it is in the path. Included here for clarity.
                delete oPayload.CostGrpId; 
                delete oPayload.CgpcrcId;
                return oPayload;
            };
            
            if (isEdit) {
                // EDIT MODE: Use OData Changeset for header update, circumstance update/create/delete
                
                // 3. Header UPDATE
                const sHeaderPath = oViewModel.getProperty("/headerBindingPath");
                
                if (!sHeaderPath) {
                    MessageBox.error("Cannot update: header binding path is missing. Please reload the page.");
                    return;
                }
                
                oModel.update(sHeaderPath, oHeaderData, {
                    groupId: that._sChangesetId,
                    merge: true
                });

                // 4. Circumstance DELETES using stored binding paths
                this._aPendingDeletes.forEach(sItemPath => {
                    if (sItemPath) {
                        oModel.remove(sItemPath, {
                            groupId: that._sChangesetId
                        });
                    } else {
                        console.error("Cannot delete circumstance: binding path is missing");
                    }
                });

                // 5. Circumstance CREATES & UPDATES
                aCircumstances.forEach(oItem => {
                    if (oItem.__isNew) {
                        // CREATE (Direct call to CircumstanceSet for independent creation)
                        let oCreatePayload = getCircumstancePayload(oItem);
                        oCreatePayload.CostGrpId = sCostGroupId; // Must include foreign key for creation
                        
                        oModel.create("/CircumstanceSet", oCreatePayload, {
                            groupId: that._sChangesetId
                        });
                    } else {
                        // UPDATE (Only if data has changed compared to initial load)
                        const oOriginalItem = this._oOriginalData.find(orig => orig.CgpcrcId === oItem.CgpcrcId);
                        
                        if (oOriginalItem && JSON.stringify(oOriginalItem) !== JSON.stringify(oItem)) {
                            
                            const sItemPath = oItem.__bindingPath;
                            
                            if (!sItemPath) {
                                console.error(`Cannot update circumstance: binding path is missing for CgpcrcId ${oItem.CgpcrcId}`);
                                return;
                            }
                            
                            oModel.update(sItemPath, getCircumstancePayload(oItem), {
                                groupId: that._sChangesetId,
                                merge: true 
                            });
                        }
                    }
                });

                // 6. Submit the Changeset
                oModel.submitChanges({
                    groupId: that._sChangesetId,
                    success: (oBatchResponse) => {
                        let bError = false;
                        
                        // High-care check of all batch responses for errors
                        oBatchResponse.__batchResponses.forEach(oBatchPart => {
                            if (oBatchPart.response && parseInt(oBatchPart.response.statusCode, 10) >= 400) {
                                bError = true;
                            }
                            if (oBatchPart.__changeResponses) {
                                oBatchPart.__changeResponses.forEach(oChangeResponse => {
                                    if (parseInt(oChangeResponse.statusCode, 10) >= 400) {
                                        bError = true;
                                    }
                                });
                            }
                        });

                        if (!bError) {
                            that.mySuccessHandler({ message: that._getText("updateSuccessMessage") });
                            that._aPendingDeletes = [];
                            oModel.refresh(true); 
                            that.onNavBack();
                        } else {
                            that.myErrorHandler(oBatchResponse, that._getText("updateErrorMessage"));
                        }
                    },
                    error: (oError) => {
                        that.myErrorHandler(oError, that._getText("updateErrorMessage"));
                    }
                });

            } else {
                // CREATE MODE: Use DEEP CREATE
                
                let oDeepPayload = oHeaderData;
                oDeepPayload.ToCircumstance = [];

                aCircumstances.forEach(oItem => {
                    // Circumstance payload for Deep Create. No need for CostGrpId here.
                    oDeepPayload.ToCircumstance.push(getCircumstancePayload(oItem));
                });

                oModel.create("/ZSCOSTGRP_CASet", oDeepPayload, {
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

        //  Utility Functions

    // Parse various date formats (Date object, OData /Date(...)/, ISO string) into a JS Date
    _parseDate: function (v) {
            if (!v) {
                return null;
            }
            if (v instanceof Date) {
                return v;
            }
            if (typeof v === "string") {
                // Handle OData date format: /Date(timestamp)/
                var m = v.match(/\/Date\((\d+)\)\//);
                if (m) {
                    return new Date(parseInt(m[1], 10));
                }
                // Handle standard date string (e.g., from DatePicker)
                var d = new Date(v);
                // Return null if the date is invalid
                return isNaN(d.getTime()) ? null : d;
            }
            return null;
        },

        // Simple text lookup placeholder for i18n (returns key by default)
        _getText: function(sText) { 
            // Placeholder for i18n lookup
            return sText; 
        },

        // Generic success handler: show a message toast
        mySuccessHandler: function(oEvent) { 
            MessageToast.show(oEvent.message); 
        },

    // Generic error handler: parse response, show MessageBox, and refresh model
    myErrorHandler: function (oError, sMessage) {
            let sDetail = "No detail message available.";

            try {
                // Enhanced error parsing for better user feedback
                if (oError.responseText) {
                    const sResponseText = oError.responseText;
                    
                    if (sResponseText.startsWith("<?xml")) {
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(sResponseText, "text/xml");
                        const errorElement = xmlDoc.querySelector("error message");
                        sDetail = errorElement ? errorElement.textContent : sResponseText;
                    } 
                    else {
                        const oErrorJson = JSON.parse(sResponseText);
                        // Check for common SAP error structures
                        sDetail = oErrorJson.error.message.value || oErrorJson.error.message;
                    }
                } else if (oError.message) {
                    sDetail = oError.message;
                }
            } catch (e) {
                sDetail = "Could not parse error response. Check browser console for network details. Raw Error: " + oError.message;
            }
            
            MessageBox.error(sMessage + "\n\nDetails:\n" + sDetail);
            // Force model refresh to clear any pending changes/error flags
            this.getOwnerComponent().getModel().refresh(true);
        },

        // Validate inputs in the view; return true if valid
        _validateInputs: function() { 
            // Implement comprehensive input validation logic here
            return true; 
        },

        //  UI Logic (Legend, Formatting) 

    // Open a contextual legend popover (Cost group vs Circumstance)
    onLegendPress: function (oEvent) {
            const oButton = oEvent.getSource();
            const oView = this.getView();

            if (!this._pLegendPopover) {
                this._pLegendPopover = Fragment.load({
                    id: oView.getId(),
                    name: "dccs.ui5.costgroups.view.LegendPopover",
                    controller: this
                }).then(function (oPopover) {
                    oView.addDependent(oPopover);
                    return oPopover;
                });
            }

            this._pLegendPopover.then(function (oPopover) {
                const sSourceId = oButton.getId ? oButton.getId() : "";
                const bIsCircumstanceLegend = sSourceId.indexOf("idLegendButton") !== -1;

                try {
                    // Logic to dynamically update the legend popover text
                    const sPrefix = bIsCircumstanceLegend ? "Circumstance" : "Cost group";
                    const oActive = oPopover.byId("legendTextActive");
                    const oNotYetActive = oPopover.byId("legendTextNotYetActive");
                    const oNotActive = oPopover.byId("legendTextNotActive");

                    if (oActive) { oActive.setText(sPrefix + " active"); }
                    if (oNotYetActive) { oNotYetActive.setText(sPrefix + " not yet active"); }
                    if (oNotActive) { oNotActive.setText(sPrefix + " not active"); }
                } catch (e) {
                    console.error("Error setting legend text:", e);
                }

                oPopover.openBy(oButton);
            }.bind(this));
        },

    // Determine highlight state (Success/Warning/Error) based on valid-from/to dates
    formatHighlight: function (vValidFrom, vValidTo) {
            var oCurrentDate = new Date();

            var oValidFrom = this._parseDate(vValidFrom);
            var oValidTo = this._parseDate(vValidTo);

            if (!oValidTo) {
                // Set ValidTo far in the future if null
                oValidTo = new Date(9999, 11, 31);
            }

            if (!oValidFrom) {
                return "Error"; // Invalid start date
            }

            if (oCurrentDate >= oValidFrom && oCurrentDate <= oValidTo) {
                return "Success"; // Currently active
            } else if (oCurrentDate < oValidFrom) {
                return "Warning"; // Not yet active
            } else {
                return "Error"; // Expired
            }
        },

    // Map highlight state to a status class for row styling
    formatRowClass: function (vValidFrom, vValidTo) {
            var sHighlight = this.formatHighlight(vValidFrom, vValidTo);
            switch (sHighlight) {
                case "Success":
                    return "status-success";
                case "Warning":
                    return "status-warning";
                case "Error":
                    return "status-error";
                default:
                    return "status-none";
            }
        },

    // Open the message popover (placeholder action)
    onMessagePopoverPress: function() { MessageToast.show("Message Popover pressed"); },
    // Cancel and navigate back
    onCancel: function() { this.onNavBack(); }
    });
});