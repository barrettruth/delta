export function fishScript(): string {
  return `# delta shell completions for fish
# Installation:
#   delta completion fish > ~/.config/fish/completions/delta.fish

set -l nouns task cat cron auth feed import export share config integration completion help

complete -c delta -e

complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a task -d "Task CRUD and status changes"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a cat -d "List categories with task counts"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a cron -d "Automation management"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a auth -d "Authentication"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a feed -d "iCal subscription management"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a import -d "Import from iCal or other sources"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a export -d "Export as iCal"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a share -d "Generate share link for a task"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a config -d "Settings management"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a integration -d "Integration management"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a completion -d "Shell completion generation"
complete -c delta -n "not __fish_seen_subcommand_from $nouns" -a help -d "Built-in help topics"

complete -c delta -l json -d "JSON output (optional comma-separated field list)"
complete -c delta -l jq -r -d "Filter JSON output (implies --json)"
complete -c delta -s q -l quiet -d "IDs only or nothing on success"
complete -c delta -l no-color -d "Disable color output"
complete -c delta -l server -r -d "Override server URL"
complete -c delta -l debug -d "Print HTTP requests and responses to stderr"
complete -c delta -l help -d "Show help"
complete -c delta -l version -d "Show version"
complete -c delta -s y -l yes -d "Skip confirmation prompts"

set -l task_verbs list add edit done delete wip block pending dep
complete -c delta -n "__fish_seen_subcommand_from task; and not __fish_seen_subcommand_from $task_verbs" -a list -d "List tasks with filters"
complete -c delta -n "__fish_seen_subcommand_from task; and not __fish_seen_subcommand_from $task_verbs" -a add -d "Create a task"
complete -c delta -n "__fish_seen_subcommand_from task; and not __fish_seen_subcommand_from $task_verbs" -a edit -d "Update a task"
complete -c delta -n "__fish_seen_subcommand_from task; and not __fish_seen_subcommand_from $task_verbs" -a done -d "Complete task(s)"
complete -c delta -n "__fish_seen_subcommand_from task; and not __fish_seen_subcommand_from $task_verbs" -a delete -d "Soft-delete task(s)"
complete -c delta -n "__fish_seen_subcommand_from task; and not __fish_seen_subcommand_from $task_verbs" -a wip -d "Set task(s) to wip"
complete -c delta -n "__fish_seen_subcommand_from task; and not __fish_seen_subcommand_from $task_verbs" -a block -d "Set task(s) to blocked"
complete -c delta -n "__fish_seen_subcommand_from task; and not __fish_seen_subcommand_from $task_verbs" -a pending -d "Set task(s) to pending"
complete -c delta -n "__fish_seen_subcommand_from task; and not __fish_seen_subcommand_from $task_verbs" -a dep -d "Dependency management"

complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l due -r -d "Due date"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l category -r -d "Category name"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l priority -r -d "Priority"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l start -r -d "Start time"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l end -r -d "End time"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l all-day -d "All-day event"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l recurrence -r -d "Recurrence rule"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l recur-mode -r -a "scheduled completion" -d "Recurrence mode"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l location -r -d "Location string"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l meeting -r -d "Meeting URL"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l notes -r -d "Plain text notes"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l status -r -a "pending wip done blocked cancelled" -d "Task status"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from add edit" -l scope -r -a "this future all" -d "Recurrence edit scope"

set -l dep_verbs add rm list
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from dep; and not __fish_seen_subcommand_from $dep_verbs" -a add -d "Add dependency"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from dep; and not __fish_seen_subcommand_from $dep_verbs" -a rm -d "Remove dependency"
complete -c delta -n "__fish_seen_subcommand_from task; and __fish_seen_subcommand_from dep; and not __fish_seen_subcommand_from $dep_verbs" -a list -d "List dependencies"

set -l cron_verbs list add edit delete run enable disable
complete -c delta -n "__fish_seen_subcommand_from cron; and not __fish_seen_subcommand_from $cron_verbs" -a list -d "List automations"
complete -c delta -n "__fish_seen_subcommand_from cron; and not __fish_seen_subcommand_from $cron_verbs" -a add -d "Create automation"
complete -c delta -n "__fish_seen_subcommand_from cron; and not __fish_seen_subcommand_from $cron_verbs" -a edit -d "Update automation"
complete -c delta -n "__fish_seen_subcommand_from cron; and not __fish_seen_subcommand_from $cron_verbs" -a delete -d "Delete automation"
complete -c delta -n "__fish_seen_subcommand_from cron; and not __fish_seen_subcommand_from $cron_verbs" -a run -d "Trigger automation manually"
complete -c delta -n "__fish_seen_subcommand_from cron; and not __fish_seen_subcommand_from $cron_verbs" -a enable -d "Enable automation"
complete -c delta -n "__fish_seen_subcommand_from cron; and not __fish_seen_subcommand_from $cron_verbs" -a disable -d "Disable automation"

set -l auth_verbs login logout status token
complete -c delta -n "__fish_seen_subcommand_from auth; and not __fish_seen_subcommand_from $auth_verbs" -a login -d "Store an API token for this server"
complete -c delta -n "__fish_seen_subcommand_from auth; and not __fish_seen_subcommand_from $auth_verbs" -a logout -d "Clear stored credentials"
complete -c delta -n "__fish_seen_subcommand_from auth; and not __fish_seen_subcommand_from $auth_verbs" -a status -d "Show current user and token source"
complete -c delta -n "__fish_seen_subcommand_from auth; and not __fish_seen_subcommand_from $auth_verbs" -a token -d "Display or manage API token"

complete -c delta -n "__fish_seen_subcommand_from auth; and __fish_seen_subcommand_from token" -a regenerate -d "Regenerate API token"

set -l feed_verbs generate revoke
complete -c delta -n "__fish_seen_subcommand_from feed; and not __fish_seen_subcommand_from $feed_verbs" -a generate -d "Generate/regenerate subscription URL"
complete -c delta -n "__fish_seen_subcommand_from feed; and not __fish_seen_subcommand_from $feed_verbs" -a revoke -d "Revoke subscription URL"

set -l config_verbs get set
complete -c delta -n "__fish_seen_subcommand_from config; and not __fish_seen_subcommand_from $config_verbs" -a get -d "Get a setting value"
complete -c delta -n "__fish_seen_subcommand_from config; and not __fish_seen_subcommand_from $config_verbs" -a set -d "Set a setting value"

set -l integration_verbs list test
complete -c delta -n "__fish_seen_subcommand_from integration; and not __fish_seen_subcommand_from $integration_verbs" -a list -d "List configured integrations"
complete -c delta -n "__fish_seen_subcommand_from integration; and not __fish_seen_subcommand_from $integration_verbs" -a test -d "Test integration API key"

set -l completion_verbs bash zsh fish
complete -c delta -n "__fish_seen_subcommand_from completion; and not __fish_seen_subcommand_from $completion_verbs" -a bash -d "Output bash completions"
complete -c delta -n "__fish_seen_subcommand_from completion; and not __fish_seen_subcommand_from $completion_verbs" -a zsh -d "Output zsh completions"
complete -c delta -n "__fish_seen_subcommand_from completion; and not __fish_seen_subcommand_from $completion_verbs" -a fish -d "Output fish completions"

complete -c delta -n "__fish_seen_subcommand_from help" -a "filters dates auth examples" -d "Help topic"
`;
}
