-- mockup-review launcher — apre un folder picker, lancia mockup-review nel terminale
-- Usato come sorgente per compilare "Mockup Review.app" via `osacompile`.

on run
	set lastProject to ""
	try
		set plistPath to (POSIX path of (path to home folder)) & ".config/mockup-review/last-project"
		set lastProject to (do shell script "cat " & quoted form of plistPath)
	end try

	try
		if lastProject is not "" and (do shell script "test -d " & quoted form of lastProject & " && echo ok || echo no") is "ok" then
			set dialogResult to display dialog "Ultimo progetto aperto:" & return & lastProject & return & return & "Aprire di nuovo questo, o scegliere una nuova cartella?" buttons {"Scegli altra cartella", "Annulla", "Apri ultimo"} default button "Apri ultimo" with icon note
			if button returned of dialogResult is "Apri ultimo" then
				set projectPath to lastProject
			else
				set projectFolder to choose folder with prompt "Seleziona la cartella del progetto da revisionare:"
				set projectPath to POSIX path of projectFolder
			end if
		else
			set projectFolder to choose folder with prompt "Seleziona la cartella del progetto da revisionare:"
			set projectPath to POSIX path of projectFolder
		end if
	on error errMsg number errNum
		if errNum is -128 then return -- user cancelled
		error errMsg number errNum
	end try

	-- strip trailing slash
	if projectPath ends with "/" then
		set projectPath to text 1 thru -2 of projectPath
	end if

	-- persist last project
	do shell script "mkdir -p " & quoted form of ((POSIX path of (path to home folder)) & ".config/mockup-review") & " && echo " & quoted form of projectPath & " > " & quoted form of ((POSIX path of (path to home folder)) & ".config/mockup-review/last-project")

	-- find the mockup-review binary
	set binPath to ""
	try
		set binPath to do shell script "command -v mockup-review || echo"
	end try
	if binPath is "" then
		-- fallback to default symlink location
		set binPath to (POSIX path of (path to home folder)) & ".local/bin/mockup-review"
		try
			do shell script "test -x " & quoted form of binPath
		on error
			display dialog "Non trovo il binario 'mockup-review'. Installalo con:" & return & return & "ln -snf ~/AI\\ AGENCY/mockup-review-plugin/bin/mockup-review ~/.local/bin/mockup-review" buttons {"OK"} default button 1 with icon stop
			return
		end try
	end if

	-- launch in Terminal
	tell application "Terminal"
		activate
		do script (quoted form of binPath & " " & quoted form of projectPath)
	end tell
end run
