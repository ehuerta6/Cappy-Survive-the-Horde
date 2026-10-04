export const starterCode = `# First: Start Horde, then Run this repair program.
# To gather in preparation: gather("wood"); deposit()

def find_item(target):
    for i in range(chest_size()):
        item = chest_get(i)
        if item == target:
            return i
    return -1

while horde_active():
    if get_base_health() <= 75:
        index = find_item("wood")
        if index != -1:
            chest_take(index)
            repair_base()
    wait_tick()
`;
