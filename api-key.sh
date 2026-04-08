# Api key for XCode:  (For browser setup, see encrypt-key.mjs)
# . Go Target -> Build Phases -> + -> New Run Script Phase, place it before Compile Sources
# . Add this script
# . add $(SRCROOT)/GeneratedApiKey.swift as an output file (and make sure XCode knows about it)
KEY=$(head -1 ~/claude-auth.txt)
echo "let anthropic_api_key = \"$KEY\"" > "$SCRIPT_OUTPUT_FILE_0"
