export const RefreshBus = {
    emit(onRefresh?: () => void) {
        // Call the provided refresh callback
        onRefresh?.();
    },
};
