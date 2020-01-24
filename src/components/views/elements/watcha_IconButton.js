import PropTypes from "prop-types";

function IconButton({ className, onClick, ...restProps }) {
    className = "watcha_IconButton" + " " + className
    return (
        <button
            type="button"
            {...{className}}
            onClick={onClick}
            {...restProps}
        />
    );
}

IconButton.PropTypes = {
    className: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired
};

export default IconButton;
