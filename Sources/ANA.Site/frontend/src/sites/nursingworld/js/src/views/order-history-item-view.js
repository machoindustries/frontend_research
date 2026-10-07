import BaseComponent from 'components/base-component';
import 'magnific-popup';
import lightboxUtils from 'modules/lightbox-utils';

class OrderHistoryItemView extends BaseComponent {
    constructor() {
        super();

        this.defaultOptions = {
            selectors: {
                orderView: '[data-order-view]',
                orderEdit: '[data-order-edit]',
            },
            modalParentClass: 'e-modal',
            modalInnerClass: 'e-modal__content',
            modalAdditionalClass: 'mfp-fade',
        };
    }

    initChildren() {
        this.$orderViewButton = this.$el.find(this.options.selectors.orderView);
        this.$orderEditButton = this.$el.find(this.options.selectors.orderEdit);
    }

    addListeners() {
        this.$orderViewButton.on('click', this._viewOrderModal.bind(this));
        this.$orderEditButton.on('click', this._editOrderModal.bind(this));
    }

    _viewOrderModal() {
        $.magnificPopup.instance.close();

        // `self` captures the component instance: inside the magnificPopup
        // open() callback below, `this` is the popup, not this component.
        // The declaration was removed by an ESLint pass (61a129cd3) that could
        // not see the usage inside the object-literal method, leaving bare
        // `self` resolving to window.self.
        const self = this;

        this.$orderViewButton.magnificPopup({
            items: {
                src: `<div class="${this.options.modalParentClass}">
                        <div class="${this.options.modalInnerClass}">
                           ${this.$orderViewButton[0].dataset.orderView}
                        </div>
                      </div>`,
                type: 'inline',
            },
            callbacks: {
                open() {
                    setTimeout(() => {
                        self.$orderViewButton.off('click.magnificPopup');

                        lightboxUtils.bindOpenModalButtons();
                    }, 0);
                },
            },
            mainClass: this.options.modalAdditionalClass,
        }).magnificPopup('open');
    }

    _editOrderModal() {
        $.magnificPopup.instance.close();

        // `self` captures the component instance: inside the magnificPopup
        // open() callback below, `this` is the popup, not this component.
        // The declaration was removed by an ESLint pass (61a129cd3) that could
        // not see the usage inside the object-literal method, leaving bare
        // `self` resolving to window.self.
        const self = this;

        this.$orderEditButton.magnificPopup({
            items: {
                src: `<div class="${this.options.modalParentClass}">
                        <div class="${this.options.modalInnerClass}">
                            ${this.$orderEditButton[0].dataset.orderEdit}
                        </div>
                      </div>`,
                type: 'inline',
            },
            callbacks: {
                open() {
                    setTimeout(() => {
                        self.$orderEditButton.off('click.magnificPopup');

                        lightboxUtils.bindOpenModalButtons();
                    }, 0);
                },
            },
            mainClass: this.options.modalAdditionalClass,
        }).magnificPopup('open');
    }
}

export default () => {
    return new OrderHistoryItemView();
};
