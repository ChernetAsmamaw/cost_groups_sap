sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "dccs/ui5/costgroups/model/formatter",
    "sap/ui/model/json/JSONModel",
    "sap/m/Popover",
    "sap/m/List",
    "sap/m/StandardListItem",
    "sap/ui/core/Item",
  ],
  function (
    Controller,
    History,
    MessageToast,
    MessageBox,
    formatter,
    JSONModel,
    Popover,
    List,
    StandardListItem,
    Item
  ) {
    "use strict";

    return Controller.extend("dccs.ui5.costgroups.controller.CostGroup", {
      formatter: formatter,
      _oErrorPopover: null,
      _sCostGroupId: null, // Store CostGroupID for later use

      // Lifecycle Methods
      onInit: function () {
        // Get the router instance and model
        this._oRouter = this.getOwnerComponent().getRouter();
        this._oModel = this.getOwnerComponent().getModel("costGroup");

        this._oRouter
          .getRoute("CostGroup")
          .attachPatternMatched(this._onRouteMatched, this);

        this._oRouter
          .getRoute("CreateCostGroup")
          .attachPatternMatched(this._onCreateRouteMatched, this);

        // --- Local Error Model Initialization ---
        var oViewModel = new JSONModel({
          ErrorMessages: [],
          // New properties for the error button
          ErrorCount: 0,
          ShowErrorButton: false,
        });
        this.getView().setModel(oViewModel, "view");
      },

      // Public Methods
      onPageNavButtonPress: function () {
        var oHistory = History.getInstance();
        var sPreviousHash = oHistory.getPreviousHash();

        if (sPreviousHash !== undefined) {
          window.history.go(-1);
        } else {
          this._oRouter.navTo(
            "TargetCostGroups",
            {},
            {
              replace: true,
            }
          );
        }
      },

      onSaveButtonPress: function () {
        var oBindingContext = this.getView().getBindingContext("costGroup");

        if (!oBindingContext) {
          MessageToast.show("No data to save");
          return;
        }

        // Validate required fields and update error model
        if (!this._validateForm()) {
          // Validation failed, ensure Popover is ready and open it automatically
          this._initErrorPopover();
          // Open the popover by the error button in the footer
          this._oErrorPopover.openBy(this.byId("idErrorButton"));
          return;
        }

        // If validation passes, ensure error button is hidden
        this.getView().getModel("view").setProperty("/ShowErrorButton", false);

        // Show confirmation dialog
        var oResourceBundle = this.getOwnerComponent()
          .getModel("i18n")
          .getResourceBundle();

        MessageBox.confirm(oResourceBundle.getText("saveConfirmation"), {
          actions: [MessageBox.Action.YES, MessageBox.Action.NO],
          emphasis: MessageBox.Action.YES,
          onClose: function (sAction) {
            if (sAction === MessageBox.Action.YES) {
              this._performSave(oBindingContext);
            }
          }.bind(this),
        });
      },

      onCancelButtonPress: function () {
        var oBindingContext = this.getView().getBindingContext("costGroup");
        var bIsCreating =
          oBindingContext && oBindingContext.getProperty("CostGrpId") === "NEW";

        var oResourceBundle = this.getOwnerComponent()
          .getModel("i18n")
          .getResourceBundle();

        if (bIsCreating || this._oModel.hasPendingChanges()) {
          MessageBox.confirm(oResourceBundle.getText("cancelConfirmation"), {
            actions: [MessageBox.Action.YES, MessageBox.Action.NO],
            emphasis: MessageBox.Action.NO,
            onClose: function (sAction) {
              if (sAction === MessageBox.Action.YES) {
                this._performCancel();
              }
            }.bind(this),
          });
        } else {
          this.onPageNavButtonPress();
        }
      },

      onLengthButtonPress: function (oEvent) {
        // This original button should be replaced by the new idErrorButton in the footer
        this._initErrorPopover();
        this._oErrorPopover.openBy(oEvent.getSource());
      },

      // New method for the actual error button in the footer
      onErrorButtonPress: function (oEvent) {
        this._initErrorPopover();
        this._oErrorPopover.openBy(oEvent.getSource());
      },

      // Circumstances Table Methods
      onButtonDeleteCircumstancePress: function () {
        var oTable = this.byId("idCircumstancesInnerTable");
        var aSelectedItems = oTable.getSelectedItems();

        if (aSelectedItems.length === 0) {
          MessageToast.show(
            "Please select at least one circumstance to delete"
          );
          return;
        }

        MessageBox.confirm(
          "Are you sure you want to delete the selected circumstance(s)?",
          {
            actions: [MessageBox.Action.YES, MessageBox.Action.NO],
            emphasis: MessageBox.Action.YES,
            onClose: function (sAction) {
              if (sAction === MessageBox.Action.YES) {
                var oCircumstancesModel =
                  this.getView().getModel("circumstances");
                var aCircumstances = oCircumstancesModel.getData().items; // Added .items check

                // Ensure aCircumstances is an array before processing
                if (!Array.isArray(aCircumstances)) {
                  aCircumstances = [];
                }

                // Get indices of selected items
                var aIndicesToDelete = [];
                aSelectedItems.forEach(function (oItem) {
                  // Get the binding path and index from the model
                  var sPath = oItem
                    .getBindingContext("circumstances")
                    .getPath();
                  var iIndex = parseInt(
                    sPath.substring(sPath.lastIndexOf("/") + 1)
                  );
                  aIndicesToDelete.push(iIndex);
                });

                // Sort indices in descending order to delete from end to start
                aIndicesToDelete.sort(function (a, b) {
                  return b - a;
                });

                // Remove items
                aIndicesToDelete.forEach(function (iIndex) {
                  aCircumstances.splice(iIndex, 1);
                });

                oCircumstancesModel.setData({ items: aCircumstances });
                oTable.removeSelections(true);
                MessageToast.show("Circumstance(s) deleted successfully");
              }
            }.bind(this),
          }
        );
      },

      onButtonAddCircumstancePress: function () {
        var oCircumstancesModel = this.getView().getModel("circumstances");
        var oCircumstancesData = oCircumstancesModel.getData();
        var aCircumstances = oCircumstancesData.items || []; // Use .items

        aCircumstances.push({
          Circumstance: "",
          CostAllocation: "",
          TaxShare: "0,00",
          ValidFrom: "",
          ValidTo: "31.12.9999",
          Editable: true,
        });

        oCircumstancesModel.setData({ items: aCircumstances });
        MessageToast.show("New circumstance added");
      },

      onCircumstanceItemPress: function (oEvent) {
        // Handle row press if needed
        var oItem = oEvent.getSource();
        var oContext = oItem.getBindingContext("circumstances");
        var sCircumstance = oContext.getProperty("Circumstance");

        if (sCircumstance) {
          MessageToast.show("Circumstance selected: " + sCircumstance);
        }
      },
      onButtonLegendPress: function (oEvent) {
        var oButton = oEvent.getSource();

        if (!this._oLegendPopover) {
          this._oLegendPopover = sap.ui.xmlfragment(
            this.getView().getId(),
            "dccs.ui5.costgroups.fragment.LegendPopOver",
            this
          );
          this.getView().addDependent(this._oLegendPopover);
        }
        this._oLegendPopover.openBy(oButton);
      },

      onComboBoxCostGroupTypeChange: function (oEvent) {
        var oComboBox = oEvent.getSource();
        var sSelectedKey = oComboBox.getSelectedKey();
        var oSelectedItem = oComboBox.getSelectedItem();

        if (oSelectedItem) {
          var sSelectedText = oSelectedItem.getText();

          // Update the CostgrptypeText field with the selected text
          var oBindingContext = this.getView().getBindingContext("costGroup");
          if (oBindingContext) {
            oBindingContext
              .getModel()
              .setProperty(
                oBindingContext.getPath() + "/CostgrptypeText",
                sSelectedText
              );
          }
        }
      },

      createCircumstanceRow: function (sId, oContext) {
        // Get current date for comparison
        var oCurrentDate = new Date();
        oCurrentDate.setHours(0, 0, 0, 0);

        var oColumnListItem = new sap.m.ColumnListItem(sId, {
          press: this.onCircumstanceItemPress.bind(this),
          type: "Active",
          highlight: {
            path: "circumstances>",
            formatter: function (oData) {
              if (!oData) return "None";

              var oValidFrom = this._parseDate(oData.ValidFrom);
              var oValidTo = this._parseDate(oData.ValidTo);

              // Default ValidTo to far future if not set
              if (!oValidTo) {
                oValidTo = new Date(9999, 11, 31);
              }

              if (!oValidFrom) {
                return "Error"; // No ValidFrom date is an error
              }

              // Set highlight based on current date
              if (oCurrentDate >= oValidFrom && oCurrentDate <= oValidTo) {
                return "Success";
              } else if (oCurrentDate < oValidFrom) {
                return "Error"; // Future date
              } else {
                return "Error"; // Past date
              }
            }.bind(this),
          },
        });

        // Create Circumstance ComboBox
        var oCircumstanceComboBox = new sap.m.ComboBox({
          selectedKey: "{circumstances>Circumstance}",
          editable: "{circumstances>Editable}",
          items: {
            path: "circumstancesTypes>/",
            template: new sap.ui.core.Item({
              key: "{circumstancesTypes>DomvalueL}",
              text: "{circumstancesTypes>Ddtext}",
            }),
            templateShareable: false,
          },
        });

        // DIAGNOSTIC: Log cost allocations model state
        var oCostAllocationsModel = this.getView().getModel("costAllocations");
        if (oCostAllocationsModel) {
          var aCostAllocations = oCostAllocationsModel.getData();
          console.log(
            "Cost Allocations Model in createCircumstanceRow:",
            aCostAllocations
          );

          // Also log what we're trying to select
          var oRowData = oContext.getObject();
          console.log(
            "Row trying to select CostAllocation:",
            oRowData.CostAllocation
          );
        } else {
          console.warn("WARNING: costAllocations model NOT found!");
        }

        // Create Cost Allocation ComboBox
        var oCostAllocationComboBox = new sap.m.ComboBox({
          selectedKey: "{circumstances>CostAllocation}",
          editable: "{circumstances>Editable}",
          items: {
            path: "costAllocations>/",
            model: "costAllocations",
            template: new sap.ui.core.Item({
              key: "{costAllocations>valpos}",
              text: "{costAllocations>cost_alloc_text}",
            }),
            templateShareable: false,
          },
        });

        // Create other input controls
        var oTaxShareInput = new sap.m.Input({
          value: "{circumstances>TaxShare}",
          editable: "{circumstances>Editable}",
          type: "Number",
        });

        var oValidFromDatePicker = new sap.m.DatePicker({
          value: "{circumstances>ValidFrom}",
          editable: "{circumstances>Editable}",
          required: true,
          valueFormat: "dd.MM.yyyy",
          displayFormat: "dd.MM.yyyy",
        });

        var oValidToDatePicker = new sap.m.DatePicker({
          value: "{circumstances>ValidTo}",
          editable: "{circumstances>Editable}",
          valueFormat: "dd.MM.yyyy",
          displayFormat: "dd.MM.yyyy",
        });

        // Add all controls as cells
        oColumnListItem.addCell(oCircumstanceComboBox);
        oColumnListItem.addCell(oCostAllocationComboBox);
        oColumnListItem.addCell(oTaxShareInput);
        oColumnListItem.addCell(oValidFromDatePicker);
        oColumnListItem.addCell(oValidToDatePicker);

        return oColumnListItem;
      },

      _initializeEmptyCircumstances: function () {
        // Initialize empty circumstances model for new cost group
        var oCircumstancesModel = new JSONModel({
          items: [],
        });
        this.getView().setModel(oCircumstancesModel, "circumstances");
      },

      // Private Methods
      _initErrorPopover: function () {
        if (this._oErrorPopover) {
          return;
        }

        var oListItemTemplate = new StandardListItem({
          title: "{view>message}",
          icon: "sap-icon://error",
          type: "Inactive",
        });

        this._oErrorPopover = new Popover({
          title: "Validation Errors",
          placement: sap.m.PlacementType.Top,
          contentWidth: "400px",
          content: [
            new List({
              items: {
                path: "view>/ErrorMessages",
                template: oListItemTemplate,
              },
            }),
          ],
        });

        // Attach to the view, not a specific button in the content area anymore
        this.getView().addDependent(this._oErrorPopover);
      },

      _onRouteMatched: function (oEvent) {
        var sCostGroupId = decodeURIComponent(
          oEvent.getParameter("arguments").CostGroupID
        );

        sCostGroupId = this._cleanupIdValue(sCostGroupId);
        this._sCostGroupId = sCostGroupId;
        this._bindCostGroup(sCostGroupId);

        // Load dropdown data FIRST, then load circumstances AFTER
        this._loadCircumstancesAndCostGroupTypes(
          function () {
            // This callback fires after dropdown data is loaded
            this._loadExistingCircumstances(sCostGroupId);
          }.bind(this)
        );

        // Clear errors on navigation
        this.getView().getModel("view").setProperty("/ErrorMessages", []);
        this.getView().getModel("view").setProperty("/ErrorCount", 0);
        this.getView().getModel("view").setProperty("/ShowErrorButton", false);
      },

      _loadCircumstancesAndCostGroupTypes: function (fnCallback) {
        const oCostGroupTypeComboBox = this.byId(
          "idCostGroupTypeCreateComboBox"
        );
        const oCommonModel = this.getView().getModel("costGroup");
        let iLoadedCount = 0;
        const iTotalRequests = 2;

        const fnCheckIfDone = function () {
          iLoadedCount++;
          if (iLoadedCount === iTotalRequests && fnCallback) {
            fnCallback();
          }
        };

        // Load circumstances types
        oCommonModel.read("/ZB_CNG_COSTGRPTEXT_JC", {
          success: function (oData) {
            const oCircumstancesTypesModel = new JSONModel(oData.results);
            this.getView().setModel(
              oCircumstancesTypesModel,
              "circumstancesTypes"
            );

            if (oCostGroupTypeComboBox) {
              const oCostGroupTypeModel = new JSONModel(oData.results);
              oCostGroupTypeComboBox.setModel(
                oCostGroupTypeModel,
                "costGroupTypes"
              );
              oCostGroupTypeComboBox.bindItems({
                path: "costGroupTypes>/",
                template: new Item({
                  key: "{costGroupTypes>DomvalueL}",
                  text: "{costGroupTypes>Ddtext}",
                }),
              });
            }
            fnCheckIfDone();
          }.bind(this),
          error: function (oError) {
            sap.m.MessageToast.show("Failed to load circumstances.");
            fnCheckIfDone();
          },
        });

        // Load cost allocations
        oCommonModel.read("/ZB_CNG_CALOC_JC", {
          success: function (oData) {
            const oCostAllocationsModel = new JSONModel(oData.results);
            console.log("Loaded cost allocations:", oData.results);
            this.getView().setModel(oCostAllocationsModel, "costAllocations");
            fnCheckIfDone();
          }.bind(this),
          error: function (oError) {
            sap.m.MessageToast.show("Failed to load cost allocations.");
            fnCheckIfDone();
          },
        });
      },

      _onCreateRouteMatched: function () {
        // Set the page title for creating a new cost group
        this.byId("idCostGroupDetailPage").setTitle("Create cost group");

        // Clear any existing bindings
        this.getView().unbindElement("costGroup");

        // Create a new entry in the model for the new cost group
        var oModel = this.getView().getModel("costGroup");
        var oContext = oModel.createEntry("/ZSCOSTGP_JC002Set", {
          properties: {
            CostGrpId: "NEW",
            NameDe: "",
            Name: "",
            InfoTextDe: "",
            InfoText: "",
            SortOrder: 0,
            CostGrpType: "",
            CostgrptypeText: "",
          },
        });

        // Bind the view to the new entry
        this.getView().setBindingContext(oContext, "costGroup");

        // Load dropdown data and initialize empty circumstances
        this._loadCircumstancesAndCostGroupTypes(function () {});
        this._initializeEmptyCircumstances();

        // Clear errors
        this.getView().getModel("view").setProperty("/ErrorMessages", []);
        this.getView().getModel("view").setProperty("/ErrorCount", 0);
        this.getView().getModel("view").setProperty("/ShowErrorButton", false);
      },
      _loadCircumstancesAndCostGroupTypes: function (fnCallback) {
        const oCostGroupTypeComboBox = this.byId(
          "idCostGroupTypeCreateComboBox"
        );
        const oCommonModel = this.getView().getModel("costGroup");
        let iLoadedCount = 0;
        const iTotalRequests = 2;

        const fnCheckIfDone = function () {
          iLoadedCount++;
          if (iLoadedCount === iTotalRequests && fnCallback) {
            fnCallback();
          }
        };

        // Load circumstances types
        oCommonModel.read("/ZB_CNG_COSTGRPTEXT_JC", {
          success: function (oData) {
            const oCircumstancesTypesModel = new JSONModel(oData.results);
            this.getView().setModel(
              oCircumstancesTypesModel,
              "circumstancesTypes"
            );

            if (oCostGroupTypeComboBox) {
              const oCostGroupTypeModel = new JSONModel(oData.results);
              oCostGroupTypeComboBox.setModel(
                oCostGroupTypeModel,
                "costGroupTypes"
              );
              oCostGroupTypeComboBox.bindItems({
                path: "costGroupTypes>/",
                template: new Item({
                  key: "{costGroupTypes>DomvalueL}",
                  text: "{costGroupTypes>Ddtext}",
                }),
              });
            }
            fnCheckIfDone();
          }.bind(this),
          error: function (oError) {
            sap.m.MessageToast.show("Failed to load circumstances.");
            fnCheckIfDone();
          },
        });

        // Load cost allocations
        oCommonModel.read("/ZB_CNG_CALOC_JC", {
          success: function (oData) {
            const oCostAllocationsModel = new JSONModel(oData.results);
            console.log("Loaded cost allocations:", oData.results);
            this.getView().setModel(oCostAllocationsModel, "costAllocations");
            fnCheckIfDone();
          }.bind(this),
          error: function (oError) {
            sap.m.MessageToast.show("Failed to load cost allocations.");
            fnCheckIfDone();
          },
        });
      },

      _cleanupIdValue: function (sId) {
        if (sId.startsWith("(") && sId.endsWith(")")) {
          sId = sId.substring(1, sId.length - 1);
        }
        if (
          (sId.startsWith("'") && sId.endsWith("'")) ||
          (sId.startsWith('"') && sId.endsWith('"'))
        ) {
          sId = sId.substring(1, sId.length - 1);
        }
        return sId;
      },

      _bindCostGroup: function (sCostGroupId) {
        var sPath = "/ZSCOSTGP_JC002Set(CostGrpId='" + sCostGroupId + "')";

        this.getView().bindElement({
          path: sPath,
          model: "costGroup",
          events: {
            dataReceived: function (oEvent) {
              var oData = oEvent.getParameter("data");
              if (!oData) {
                this._showNotFoundMessage();
              } else {
                this._oOriginalData = JSON.parse(JSON.stringify(oData));
                console.log("Original Data:", this._oOriginalData);
                // Load circumstances for this cost group
                this._loadExistingCircumstances(sCostGroupId);
              }
            }.bind(this),
            dataRequested: function () {
              this._showBusyIndicator(true);
            }.bind(this),
            change: function (oEvent) {
              this._showBusyIndicator(false);
            }.bind(this),
          },
        });
      },

      _loadExistingCircumstances: function (sCostGroupId) {
        var oModel = this.getView().getModel("costGroup");
        var sPath = "/ZSCOSTGP_JC002Set('" + sCostGroupId + "')/CostGRPToCRC";


        oModel.read(sPath, {
          success: function (oData) {
            var aCircumstances = [];

            // Transform the loaded data to match the circumstances table format
            if (oData.results && oData.results.length > 0) {
              aCircumstances = oData.results.map(
                function (oItem) {
                  // Pad CostAlloc to 4 digits to match the model's valpos format
                  var sPaddedCostAlloc = ("00" + oItem.CostAlloc).slice(-4);
                  // console.log(sPaddedCostAlloc + " <- padded");
                  // console.log("Raw OData Item:", {
                  //   CostAlloc: oItem.CostAlloc,
                  //   PaddedCostAlloc: sPaddedCostAlloc,
                  //   Circid: oItem.Circid,
                  //   CgpcrcId: oItem.CgpcrcId,
                  // });

                  return {
                    CgpcrcId: oItem.CgpcrcId,
                    Circumstance: oItem.Circid,
                    CostAllocation: sPaddedCostAlloc, // Use padded value
                    TaxShare: oItem.TaxRate,
                    ValidFrom: this._formatDateForDisplay(oItem.ValidFrom),
                    ValidTo: this._formatDateForDisplay(oItem.ValidTo),
                    Editable: true,
                    IsDeactivated: oItem.IsDeactivated,
                  };
                }.bind(this)
              );

              console.log("Transformed Circumstances:", aCircumstances);
            }

            // Set the circumstances model
            var oCircumstancesModel = new JSONModel({
              items: aCircumstances,
            });
            this.getView().setModel(oCircumstancesModel, "circumstances");
          }.bind(this),
          error: function (oError) {
            console.error("Failed to load circumstances:", oError);
            var oCircumstancesModel = new JSONModel({
              items: [],
            });
            this.getView().setModel(oCircumstancesModel, "circumstances");
            MessageToast.show(
              "Failed to load circumstances for this cost group"
            );
          }.bind(this),
        });
      },

      _formatDateForDisplay: function (sODataDate) {
        if (!sODataDate) return "";

        try {
          var oDate;

          // Handle OData date format /Date(timestamp)/ or ISO string
          if (
            typeof sODataDate === "string" &&
            sODataDate.indexOf("/Date(") === 0
          ) {
            var sTimestamp = sODataDate.substring(6, sODataDate.length - 2);
            oDate = new Date(parseInt(sTimestamp));
          } else {
            oDate = new Date(sODataDate);
          }

          if (isNaN(oDate.getTime())) {
            return "";
          }

          // Format as dd.MM.yyyy
          var sDay = oDate.getDate().toString().padStart(2, "0");
          var sMonth = (oDate.getMonth() + 1).toString().padStart(2, "0");
          var sYear = oDate.getFullYear().toString();

          return sDay + "." + sMonth + "." + sYear;
        } catch (e) {
          console.error("Error formatting date:", sODataDate, e);
          return "";
        }
      },

      _showBusyIndicator: function (bShow) {
        var oPage = this.byId("idCostGroupDetailPage");
        if (oPage) {
          oPage.setBusy(bShow);
        }
      },

      _showNotFoundMessage: function () {
        MessageToast.show(
          this.getOwnerComponent()
            .getModel("i18n")
            .getResourceBundle()
            .getText("costGroupNotFound")
        );
        this.onPageNavButtonPress();
      },

      _validateForm: function () {
        var oView = this.getView();
        var oViewModel = oView.getModel("view");
        var aErrorMessages = [];
        var oInfoTextInput = oView.byId("idInfoTextInput");
        var oNameDeInput = oView.byId("idNameDeDesignationGermanInput");
        var oInfoTextDeInput = oView.byId("idInfoTextDeGermanInput");
        var oNameEnInput = oView.byId("idNameInput");
        var oSortOrderInput = oView.byId("idSortOrder2Input");

        var oResourceBundle = this.getOwnerComponent()
          .getModel("i18n")
          .getResourceBundle();
        var bValid = true;

        // Reset all value states
        oInfoTextInput.setValueState("None").setValueStateText("");
        oNameDeInput.setValueState("None").setValueStateText("");
        oInfoTextDeInput.setValueState("None").setValueStateText("");
        oNameEnInput.setValueState("None").setValueStateText("");
        oSortOrderInput.setValueState("None").setValueStateText("");

        // Helper function to set error state and add to model
        var fnAddError = function (oControl, sFieldLabel) {
          var sMessage =
            sFieldLabel +
            " " +
            oResourceBundle.getText("validation.FieldMustNotBeEmpty");
          oControl.setValueState("Error");
          oControl.setValueStateText(sMessage);
          aErrorMessages.push({
            message: sMessage,
          });
          bValid = false;
        };

        // Helper for numeric error
        var fnAddNumericError = function (oControl, sFieldLabel) {
          var sMessage =
            sFieldLabel +
            " " +
            oResourceBundle.getText("validation.SortOrderNumeric");
          oControl.setValueState("Error");
          oControl.setValueStateText(sMessage);
          aErrorMessages.push({
            message: sMessage,
          });
          bValid = false;
        };

        // --- Validation Checks ---
        var sLabelDesignation = oResourceBundle.getText("label.Designation");
        var sLabelInfoText = oResourceBundle.getText("label.InfoText");
        var sLabelSortOrder = oResourceBundle.getText("label.SortOrder");

        // 1. German Designation (required)
        if (!oNameDeInput.getValue().trim()) {
          fnAddError(oNameDeInput, "German " + sLabelDesignation);
        }

        // 2. German Info text (required)
        if (!oInfoTextDeInput.getValue().trim()) {
          fnAddError(oInfoTextDeInput, "German " + sLabelInfoText);
        }

        // 3. English Designation (required)
        if (!oNameEnInput.getValue().trim()) {
          fnAddError(oNameEnInput, "English " + sLabelDesignation);
        }

        // 4. English Info text (required)
        if (!oInfoTextInput.getValue().trim()) {
          fnAddError(oInfoTextInput, "English " + sLabelInfoText);
        }

        // 5. Sort order (required and numeric)
        var sSortOrder = oSortOrderInput.getValue();
        if (!sSortOrder.trim()) {
          fnAddError(oSortOrderInput, sLabelSortOrder);
        } else if (isNaN(parseInt(sSortOrder))) {
          fnAddNumericError(oSortOrderInput, sLabelSortOrder);
        }

        // 6. Cost Group Type (required in create mode)
        var oBindingContext = this.getView().getBindingContext("costGroup");
        var bIsCreating =
          oBindingContext && oBindingContext.getProperty("CostGrpId") === "NEW";

        if (bIsCreating) {
          var oCostGroupTypeComboBox = oView.byId(
            "idCostGroupTypeCreateComboBox"
          );
          if (oCostGroupTypeComboBox) {
            oCostGroupTypeComboBox.setValueState("None").setValueStateText("");

            if (!oCostGroupTypeComboBox.getSelectedKey()) {
              var sMessage =
                "Cost Group Type " +
                oResourceBundle.getText("validation.FieldMustNotBeEmpty");
              oCostGroupTypeComboBox.setValueState("Error");
              oCostGroupTypeComboBox.setValueStateText(sMessage);
              aErrorMessages.push({
                message: sMessage,
              });
              bValid = false;
            }
          }
        }

        // 7. Validate Circumstances Table
        var bTableValid = this._validateCircumstancesTable(aErrorMessages);
        if (!bTableValid) {
          bValid = false;
        }

        oViewModel.setProperty("/ErrorMessages", aErrorMessages);
        oViewModel.setProperty("/ErrorCount", aErrorMessages.length);
        oViewModel.setProperty("/ShowErrorButton", aErrorMessages.length > 0);

        return bValid;
      },

      _validateCircumstancesTable: function (aErrorMessages) {
        var oTable = this.byId("idCircumstancesInnerTable");
        var aItems = oTable.getItems();
        var bValid = true;

        // Iterate through all table rows
        aItems.forEach(
          function (oItem, iIndex) {
            var aCells = oItem.getCells();
            var iRowNumber = iIndex + 1;

            // Reset all cell value states
            aCells.forEach(function (oCell) {
              if (oCell.setValueState) {
                oCell.setValueState("None");
                oCell.setValueStateText("");
              }
            });

            // Get controls from cells
            var oCircumstanceComboBox = aCells[0]; // Circumstance
            var oCostAllocationComboBox = aCells[1]; // Cost allocation
            var oTaxShareInput = aCells[2]; // Tax share
            var oValidFromDatePicker = aCells[3]; // Valid from
            var oValidToDatePicker = aCells[4]; // Valid to

            // Validate Circumstance (required)
            if (!oCircumstanceComboBox.getSelectedKey()) {
              oCircumstanceComboBox.setValueState("Error");
              oCircumstanceComboBox.setValueStateText(
                "Circumstance is required"
              );
              aErrorMessages.push({
                message: "Row " + iRowNumber + ": Circumstance is required",
              });
              bValid = false;
            }

            // Validate Cost Allocation (required)
            if (!oCostAllocationComboBox.getSelectedKey()) {
              oCostAllocationComboBox.setValueState("Error");
              oCostAllocationComboBox.setValueStateText(
                "Cost allocation is required"
              );
              aErrorMessages.push({
                message: "Row " + iRowNumber + ": Cost allocation is required",
              });
              bValid = false;
            }

            // Validate Tax Share (required and range 0-100)
            var sTaxShare = oTaxShareInput.getValue().replace(",", ".");
            if (!sTaxShare || sTaxShare.trim() === "") {
              oTaxShareInput.setValueState("Error");
              oTaxShareInput.setValueStateText("Tax share is required");
              aErrorMessages.push({
                message: "Row " + iRowNumber + ": Tax share is required",
              });
              bValid = false;
            } else {
              var fTaxShare = parseFloat(sTaxShare);
              if (isNaN(fTaxShare) || fTaxShare < 0 || fTaxShare > 100) {
                oTaxShareInput.setValueState("Error");
                oTaxShareInput.setValueStateText(
                  "Tax rate must be >= 0 and <= 100"
                ); // Corrected text
                aErrorMessages.push({
                  message:
                    "Row " + iRowNumber + ": Tax rate must be >= 0 and <= 100", // Corrected text
                });
                bValid = false;
              }
            }

            // Validate Valid From (required)
            if (!oValidFromDatePicker.getValue()) {
              oValidFromDatePicker.setValueState("Error");
              oValidFromDatePicker.setValueStateText(
                "Valid from date is required"
              );
              aErrorMessages.push({
                message: "Row " + iRowNumber + ": Valid from date is required",
              });
              bValid = false;
            }

            // Validate Valid To (optional, but if filled must be after Valid From)
            var sValidFrom = oValidFromDatePicker.getValue();
            var sValidTo = oValidToDatePicker.getValue();

            if (sValidFrom && sValidTo) {
              var oValidFromDate = this._parseDate(sValidFrom);
              var oValidToDate = this._parseDate(sValidTo);

              if (
                oValidFromDate &&
                oValidToDate &&
                oValidToDate < oValidFromDate
              ) {
                oValidToDatePicker.setValueState("Error");
                oValidToDatePicker.setValueStateText(
                  "Valid to must be after Valid from"
                );
                aErrorMessages.push({
                  message: "Row " + iRowNumber + ": Invalid date range",
                });
                bValid = false;
              }
            }
          }.bind(this)
        );

        return bValid;
      },

      // Ensure _parseDate method handles all date formats
      _parseDate: function (sDateString) {
        if (!sDateString) return null;

        // Handle different date formats
        var oDate;

        // Handle dd.MM.yyyy format
        if (sDateString.includes(".")) {
          var aParts = sDateString.split(".");
          if (aParts.length === 3) {
            oDate = new Date(
              parseInt(aParts[2]),
              parseInt(aParts[1]) - 1,
              parseInt(aParts[0])
            );
          }
        }
        // Handle ISO date string
        else if (typeof sDateString === "string") {
          oDate = new Date(sDateString);
        }

        return isNaN(oDate.getTime()) ? null : oDate;
      },

      _performSave: function (oBindingContext) {
        var oModel = this._oModel;

        // Check if this is a new cost group being created
        var bIsCreating = oBindingContext.getProperty("CostGrpId") === "NEW";

        if (bIsCreating) {
          // Build the deep entity structure for new cost groups
          var oDeepEntity = this._buildDeepEntityPayload();

          // Debug: Log the payload being sent
          console.log(
            "Deep Entity Payload:",
            JSON.stringify(oDeepEntity, null, 2)
          );

          // Create new cost group via OData CREATE with deep entity
          oModel.create("/ZSCOSTGP_JC002Set", oDeepEntity, {
            success: function (oCreatedData) {
              MessageToast.show("Cost Group created successfully");

              // Navigate to the newly created cost group's detail page
              var sNewCostGroupId = oCreatedData.CostGrpId;
              this._oRouter.navTo("CostGroup", {
                CostGroupID: encodeURIComponent(sNewCostGroupId),
              });
            }.bind(this),
            error: function (oError) {
              var sErrorMsg = "Error creating cost group";
              try {
                var oErrorResponse = JSON.parse(oError.responseText);
                sErrorMsg += ": " + oErrorResponse.error.message.value;
              } catch (e) {
                sErrorMsg += ": " + (oError.message || "Unknown error");
              }
              MessageBox.error(sErrorMsg);
            },
          });
        } else {
          // For existing cost groups, use the normal submit changes
          oModel.submitChanges({
            success: function () {
              MessageToast.show("Cost Group saved successfully");
              oBindingContext.getModel().refresh();
              this._bindCostGroup(this._sCostGroupId);
            }.bind(this),
            error: function (oError) {
              var sErrorMsg = "Error saving cost group";
              try {
                var oErrorResponse = JSON.parse(oError.responseText);
                sErrorMsg += ": " + oErrorResponse.error.message.value;
              } catch (e) {
                sErrorMsg += ": " + (oError.message || "Unknown error");
              }
              MessageBox.error(sErrorMsg);
            },
          });
        }
      },

      _buildDeepEntityPayload: function () {
        var oBindingContext = this.getView().getBindingContext("costGroup");
        var oCircumstancesModel = this.getView().getModel("circumstances");

        // Get main cost group data
        var oMainData = oBindingContext.getProperty("");

        // Get circumstances data
        var aCircumstances = oCircumstancesModel.getData().items || [];

        // Build the deep entity payload
        var oDeepEntity = {
          SortOrder: parseInt(oMainData.SortOrder, 10),
          CostGrpType: oMainData.CostGrpType,
          Name: oMainData.Name,
          InfoText: oMainData.InfoText,
          NameDe: oMainData.NameDe,
          InfoTextDe: oMainData.InfoTextDe,
          CostGRPToCRC: [],
        };

        // Convert circumstances to CostGRPToCRC format
        aCircumstances.forEach(
          function (oCircumstance) {
            if (oCircumstance.Circumstance && oCircumstance.CostAllocation) {
              var oCrcItem = {
                Circid: "01", // Fixed as requested - doesn't change
                CostAlloc: ("00" + oCircumstance.CostAllocation).slice(-2),
                TaxRate: this._formatTaxRate(oCircumstance.TaxShare),
                ValidFrom: this._formatDateForOData(oCircumstance.ValidFrom),
                ValidTo: this._formatDateForOData(oCircumstance.ValidTo),
                IsDeactivated: false,
              };
              oDeepEntity.CostGRPToCRC.push(oCrcItem);
            }
          }.bind(this)
        );

        return oDeepEntity;
      },

      _formatTaxRate: function (sTaxShare) {
        if (!sTaxShare) return "0.00";

        // Replace comma with dot and ensure 2 decimal places
        var sTaxRate = sTaxShare.replace(",", ".");
        var fTaxRate = parseFloat(sTaxRate);

        if (isNaN(fTaxRate)) return "0.00";

        return fTaxRate.toFixed(2);
      },

      _formatDateForOData: function (sDate) {
        if (!sDate || sDate.trim() === "") {
          // For ValidTo, if empty, use far future date (31.12.9999)
          return "/Date(253402214400000)/"; // This represents 31.12.9999
        }

        try {
          var oDate;

          // Handle different date formats
          if (sDate.includes(".")) {
            // Format: dd.MM.yyyy
            var aParts = sDate.split(".");
            if (aParts.length === 3) {
              oDate = new Date(
                parseInt(aParts[2]),
                parseInt(aParts[1]) - 1,
                parseInt(aParts[0])
              );
            }
          } else {
            // Try to parse as regular date
            oDate = new Date(sDate);
          }

          if (isNaN(oDate.getTime())) {
            return "/Date(253402214400000)/"; // Default to far future
          }

          // Convert to OData JSON date format: /Date(timestamp)/
          return "/Date(" + oDate.getTime() + ")/";
        } catch (e) {
          console.error("Error formatting date:", sDate, e);
          return "/Date(253402214400000)/"; // Default to far future
        }
      },

      _performCancel: function () {
        var oBindingContext = this.getView().getBindingContext("costGroup");
        var bIsCreating =
          oBindingContext && oBindingContext.getProperty("CostGrpId") === "NEW";

        if (bIsCreating) {
          // For new cost groups, delete the created entry to avoid orphaned records
          this._oModel.deleteCreatedEntry(oBindingContext);
        } else {
          // For existing cost groups, reset changes
          this._oModel.resetChanges();
        }

        this.getView().getModel("view").setProperty("/ErrorMessages", []);
        this.getView().getModel("view").setProperty("/ErrorCount", 0);
        this.getView().getModel("view").setProperty("/ShowErrorButton", false);
        this.onPageNavButtonPress();
      },
    });
  }
);

<mvc:View controllerName="dccs.ui5.costgroups.controller.CostGroup"
    xmlns:mvc="sap.ui.core.mvc"
    xmlns="sap.m"
    xmlns:f="sap.ui.layout.form"
    xmlns:core="sap.ui.core"
    xmlns:smartTable="sap.ui.comp.smarttable"
    displayBlock="true">
    <Page id="idCostGroupDetailPage"
        title="Edit cost group"
        showNavButton="true"
        navButtonPress=".onPageNavButtonPress">
        <content>
            <VBox id="idEditCostgroupVBox"
                class="sapUiMediumMargin">
                <f:Form id="idCostGroupForm"
                    editable="true"
                    width="100%">
                    <f:title>
                        <core:Title id="idDonationsFromThirdPartiesTitle"
                            text="Donations from third parties"/>
                    </f:title>
                    <f:layout>
                        <f:ResponsiveGridLayout id="idResponsiveGridLayout"
                            labelSpanXL="3"
                            labelSpanL="3"
                            labelSpanM="3"
                            adjustLabelSpan="false"
                            emptySpanXL="4"
                            emptySpanL="4"
                            emptySpanM="4"
                            columnsXL="2"
                            columnsM="2"
                            singleContainerFullSize="false" />
                    </f:layout>
                    <f:formContainers>
                        <f:FormContainer id="idFormContainer">
                            <f:title>
                                <core:Title id="idGermanTitle"
                                    text="German"/>
                            </f:title>
                            <f:formElements>
                                <f:FormElement id="idDesignationGermanFormElement">
                                    <f:label>
                                        <Label id="idDesignationGermanLabel"
                                            text="Designation"/>
                                    </f:label>
                                    <f:fields>
                                        <Input id="idNameDeDesignationGermanInput"
                                            required="true"
                                            value="{costGroup>NameDe}"
                                            width="300px" />
                                    </f:fields>
                                </f:FormElement>
                                <f:FormElement id="idInfoTextGermanFormElement">
                                    <f:label>
                                        <Label id="idInfoTextGermanLabel"
                                            text="Info text"/>
                                    </f:label>
                                    <f:fields>
                                        <Input id="idInfoTextDeGermanInput"
                                            required="true"
                                            value="{costGroup>InfoTextDe}"
                                            width="300px" />
                                    </f:fields>
                                </f:FormElement>
                            </f:formElements>
                        </f:FormContainer>
                        <f:FormContainer id="idEnglishFormContainer">
                            <f:title>
                                <core:Title id="idEnglishTitle"
                                    text="English"/>
                            </f:title>
                            <f:formElements>
                                <f:FormElement id="idInfoTextEnglishFormElement">
                                    <f:label>
                                        <Label id="idDesignationEnglishLabel"
                                            text="Designation"/>
                                    </f:label>
                                    <f:fields>
                                        <Input id="idNameInput"
                                            required="true"
                                            value="{costGroup>Name}"
                                            width="300px" />
                                    </f:fields>
                                </f:FormElement>
                                <f:FormElement id="idInfoTextEnglish2FormElement">
                                    <f:label>
                                        <Label id="idInfoTextEnglishLabel"
                                            text="Info text"/>
                                    </f:label>
                                    <f:fields>
                                        <Input id="idInfoTextInput"
                                            required="true"
                                            value="{costGroup>InfoText}"
                                            width="300px" />
                                    </f:fields>
                                </f:FormElement>
                            </f:formElements>
                        </f:FormContainer>
                    </f:formContainers>
                </f:Form>
                <VBox id="idParametersSectionVBox"
                    class="sapUiMediumMarginTop">
                    <f:SimpleForm id="idParametersSimpleForm"
                        editable="true"
                        labelSpanL="3"
                        labelSpanM="3"
                        adjustLabelSpan="false"
                        emptySpanM="4"
                        columnsL="1"
                        singleContainerFullSize="false">
                        <f:title>
                            <core:Title id="idParametersTitle"
                                text="Parameters"/>
                        </f:title>
                        <f:content>
                            <Label id="idSortOrder2Label"
                                text="Sort order"/>
                            <Input id="idSortOrder2Input"
                                value="{costGroup>SortOrder}"
                                required="true"
                                type="Number"
                                width="300px" />
                            <Label id="idCostGroupType2Label"
                                text="Cost group type"/>
                            <FlexBox id="idFlexBox"
                            >
                                <Input id="idCostgrptypeTextInput"
                                    value="{costGroup>CostgrptypeText}"
                                    editable="false"
                                    width="300px"
                                    visible="{= ${costGroup>CostGrpId} !== 'NEW'}" />

                                <ComboBox id="idCostGroupTypeCreateComboBox"
                                    selectedKey="{costGroup>CostGrpType}"
                                    placeholder="Select cost group type"
                                    required="true"
                                    width="300px"
                                    visible="{= ${costGroup>CostGrpId} === 'NEW'}"
                                    change=".onComboBoxCostGroupTypeChange">
                                </ComboBox>
                            </FlexBox>
                            <!-- SmartTable for Assigned Circumstances -->
                            <Label id="idAssignedCircumstancesLabel"
                                text="" />


                        </f:content>
                    </f:SimpleForm>
                    <OverflowToolbar id="idCircumstancesOverflowToolbar"
                        style="Clear"
                        design="Transparent">
                        <HBox id="idCircumstancesTitleHBox"
                            alignItems="Center">
                            <Button id="idLegend2Button"
                                icon="sap-icon://legend"
                                tooltip="Show Legend"
                                press=".onButtonLegendPress"
                                type="Transparent" />
                            <Title id="idAssignedCircumstancesTitle"
                                text="Assigned circumstances"
                                level="H3" />
                        </HBox>
                        <ToolbarSpacer id="idCircumstancesToolbarSpacer"/>

                        <Button id="idDeleteCircumstanceButton"
                            icon="sap-icon://delete"
                            tooltip="Delete Selected Circumstances"
                            press=".onButtonDeleteCircumstancePress"
                            type="Transparent" />

                        <Button id="idAddCircumstanceButton"
                            icon="sap-icon://add"
                            tooltip="Add Circumstance"
                            press=".onButtonAddCircumstancePress"
                            type="Transparent" />
                    </OverflowToolbar>

                    <smartTable:SmartTable id="idCircumstancesSmartTable"
                        tableType="ResponsiveTable"
                        useVariantManagement="false"
                        enableAutoBinding="false">

                        <Table id="idCircumstancesInnerTable"
                            mode="MultiSelect"
                            items="{path: 'circumstances>/items', factory: '.createCircumstanceRow' }">
                            <columns>
                                <Column id="idCircumstanceColumn"
                                    width="25%">
                                    <header>
                                        <Text id="idCircumstanceHeaderText"
                                            text="Circumstance" />
                                    </header>
                                </Column>
                                <Column id="idCostAllocationColumn"
                                    width="25%">
                                    <header>
                                        <Text id="idCostAllocationHeaderText"
                                            text="Cost allocation" />
                                    </header>
                                </Column>
                                <Column id="idTaxShareColumn"
                                    width="15%">
                                    <header>
                                        <Text id="idTaxShareHeaderText"
                                            text="Tax share (0-100%)" />
                                    </header>
                                </Column>
                                <Column id="idValidFromColumn"
                                    width="15%">
                                    <header>
                                        <HBox id="idValidFromHBox">
                                            <Text id="idValidFromHeaderText"
                                                text="Valid from" />

                                        </HBox>
                                    </header>
                                </Column>
                                <Column id="idValidToColumn"
                                    width="15%">
                                    <header>
                                        <Text id="idValidToHeaderText"
                                            text="Valid to" />
                                    </header>
                                </Column>
                            </columns>
                        </Table>
                    </smartTable:SmartTable>
                </VBox>
            </VBox>
        </content>
        <footer>
            <OverflowToolbar id="idOverflowToolbar">
                <Button id="idLengthButton"
                    icon="sap-icon://message-popup"
                    text="{view>/ErrorMessages/length}"
                    visible="{= ${view>/ErrorMessages/length} > 0 }"
                    press=".onLengthButtonPress" />

                <ToolbarSpacer id="idCostGroupDetail2ToolbarSpacer" />
                <Button id="idSaveCostGroupButton"
                    text="Save"
                    type="Emphasized"
                    press=".onSaveButtonPress" />
                <Button id="idCancelCostGroupButton"
                    text="Cancel"
                    press=".onCancelButtonPress" />
            </OverflowToolbar>
        </footer>
    </Page>
</mvc:View>
